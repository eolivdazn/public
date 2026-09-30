const test = require("node:test");
const assert = require("node:assert/strict");

const store = require("../lib/expense-store");
const photoStore = require("../lib/photo-store");
const { createFakeContainer, createFakeAuditContainer, createFakeBlobContainerClient } = require("./helpers/fakes");

const actor = { userId: "u1", userDetails: "eduardo" };

async function setup(blobNames = []) {
  const container = createFakeContainer();
  const auditContainer = createFakeAuditContainer();
  const blobContainerClient = createFakeBlobContainerClient();
  for (const blobName of blobNames) {
    await blobContainerClient.getBlockBlobClient(blobName).uploadData(Buffer.from("img"), {});
  }
  const testStore = store.createExpenseStore({ container, auditContainer, blobContainerClient });
  return { testStore, auditContainer, blobContainerClient };
}

test("photo-store exposes the photo operations and validation", () => {
  for (const name of ["listPhotos", "addPhoto", "removePhoto", "normalizePhotoInput"]) {
    assert.equal(typeof photoStore[name], "function", name);
  }
  assert.equal(photoStore.TRIP_PHOTO_DOC_TYPE, "tripPhoto");
});

test("normalizePhotoInput builds a tripPhoto document with optional caption, date and location", () => {
  const photo = store.normalizePhotoInput(
    {
      tripSlug: "valencia2026",
      blobName: "valencia2026/abc-123.jpg",
      caption: "  Sunset at Malvarrosa  ",
      takenOn: "2026-10-17",
      location: { latitude: 39.47, longitude: -0.32 }
    },
    actor
  );
  assert.equal(photo.docType, "tripPhoto");
  assert.equal(photo.tripSlug, "valencia2026");
  assert.equal(photo.blobName, "valencia2026/abc-123.jpg");
  assert.equal(photo.caption, "Sunset at Malvarrosa");
  assert.equal(photo.takenOn, "2026-10-17");
  assert.deepEqual(photo.location, { latitude: 39.47, longitude: -0.32 });
  assert.deepEqual(photo.createdBy, { userId: "u1", userDetails: "eduardo" });
  assert.ok(photo.id);
  assert.ok(photo.createdAt);

  const bare = store.normalizePhotoInput({ tripSlug: "valencia2026", blobName: "valencia2026/abc.png" });
  assert.equal(bare.caption, null);
  assert.equal(bare.takenOn, null);
  assert.equal(bare.location, null);
  assert.equal(bare.createdBy, null);
});

test("normalizePhotoInput rejects missing fields, foreign or malformed images, long captions and bad dates/locations", () => {
  const base = { tripSlug: "valencia2026", blobName: "valencia2026/abc.jpg" };
  const cases = [
    [{ ...base, tripSlug: "" }, /'tripSlug' is required/],
    [{ ...base, blobName: "" }, /'blobName' is required/],
    [{ ...base, blobName: "algarve2026/abc.jpg" }, /not an image uploaded for trip 'valencia2026'/],
    [{ ...base, blobName: "valencia2026/../x.jpg" }, /not an image uploaded/],
    [{ ...base, blobName: "valencia2026/abc.gif" }, /not an image uploaded/],
    [{ ...base, caption: "x".repeat(201) }, /at most 200 characters/],
    [{ ...base, takenOn: "2026-13-40" }, /takenOn/],
    [{ ...base, location: { latitude: 120, longitude: 0 } }, /location.latitude/]
  ];
  for (const [payload, error] of cases) {
    assert.throws(() => store.normalizePhotoInput(payload), error, JSON.stringify(payload));
  }
  assert.throws(() => store.normalizePhotoInput(null), /JSON object/);
});

test("addPhoto stores the photo, returns a read URL and records a photo audit entry", async () => {
  const { testStore, auditContainer } = await setup(["valencia2026/p1.jpg"]);
  const photo = await testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/p1.jpg", caption: "Beach" }, actor);

  assert.equal(photo.caption, "Beach");
  assert.match(photo.url, /valencia2026\/p1\.jpg\?sas=fake&perm=r/);
  assert.equal(auditContainer.records.length, 1);
  assert.equal(auditContainer.records[0].action, "create");
  assert.equal(auditContainer.records[0].kind, "photo");
  assert.equal(auditContainer.records[0].photoId, photo.id);
  assert.equal(auditContainer.records[0].expenseId, null);
});

test("listPhotos returns only the trip's photos, oldest first, and expenses never include photos", async () => {
  const { testStore } = await setup(["valencia2026/p1.jpg", "valencia2026/p2.jpg", "valencia2026/food.jpg", "algarve2026/p3.jpg"]);
  const first = await testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/p1.jpg" });
  await new Promise((resolve) => setTimeout(resolve, 2));
  const second = await testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/p2.jpg" });
  await testStore.addPhoto({ tripSlug: "algarve2026", blobName: "algarve2026/p3.jpg" });
  await testStore.addEntry({ tripSlug: "valencia2026", category: "food", amount: 12, photos: [{ blobName: "valencia2026/food.jpg" }] });

  const photos = await testStore.listPhotos("valencia2026");
  assert.deepEqual(
    photos.map((photo) => photo.id),
    [first.id, second.id]
  );
  assert.ok(photos.every((photo) => photo.url && !("_etag" in photo)));

  const entries = await testStore.listEntries("valencia2026");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].category, "food");
  assert.equal((await testStore.listEntries()).some((entry) => entry.docType), false);

  await assert.rejects(() => testStore.listPhotos(""), /'tripSlug' is required/);
});

test("an image can belong to one document only, whether it's an expense or a photo", async () => {
  const { testStore } = await setup(["valencia2026/food.jpg", "valencia2026/view.jpg"]);
  await testStore.addEntry({ tripSlug: "valencia2026", category: "food", amount: 12, photos: [{ blobName: "valencia2026/food.jpg" }] });
  await testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/view.jpg" });

  // A photo can't claim an expense's image, an expense can't claim a photo's, and a photo can't be added twice.
  await assert.rejects(
    () => testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/food.jpg" }),
    /already belongs to another expense or photo/
  );
  await assert.rejects(
    () => testStore.addEntry({ tripSlug: "valencia2026", category: "food", amount: 5, photos: [{ blobName: "valencia2026/view.jpg" }] }),
    /already belongs to another expense or photo/
  );
  await assert.rejects(
    () => testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/view.jpg" }),
    /already belongs to another expense or photo/
  );
});

test("removePhoto deletes the photo and its image and records a photo audit entry", async () => {
  const { testStore, auditContainer, blobContainerClient } = await setup(["valencia2026/p1.jpg"]);
  const photo = await testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/p1.jpg" }, actor);

  await testStore.removePhoto("valencia2026", photo.id, actor);

  assert.deepEqual(await testStore.listPhotos("valencia2026"), []);
  assert.equal(blobContainerClient.blobs.has("valencia2026/p1.jpg"), false);
  const last = auditContainer.records[auditContainer.records.length - 1];
  assert.equal(last.action, "delete");
  assert.equal(last.kind, "photo");
  assert.equal(last.photoId, photo.id);
});

test("photos and expenses can't be deleted or edited through each other's operations", async () => {
  const { testStore, blobContainerClient } = await setup(["valencia2026/view.jpg", "valencia2026/food.jpg"]);
  const photo = await testStore.addPhoto({ tripSlug: "valencia2026", blobName: "valencia2026/view.jpg" });
  const expense = await testStore.addEntry({
    tripSlug: "valencia2026",
    category: "food",
    amount: 12,
    photos: [{ blobName: "valencia2026/food.jpg" }]
  });

  await assert.rejects(() => testStore.removePhoto("valencia2026", expense.id), /Photo not found/);
  await assert.rejects(() => testStore.removeEntry("valencia2026", photo.id), /Expense not found/);
  await assert.rejects(
    () => testStore.updateEntry("valencia2026", photo.id, { tripSlug: "valencia2026", category: "food", amount: 1 }),
    /Expense not found/
  );
  await assert.rejects(() => testStore.removePhoto("valencia2026", "missing"), /Photo not found/);

  assert.equal(blobContainerClient.blobs.has("valencia2026/view.jpg"), true);
  assert.equal(blobContainerClient.blobs.has("valencia2026/food.jpg"), true);
});
