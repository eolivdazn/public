const test = require("node:test");
const assert = require("node:assert/strict");

const store = require("../lib/expense-store");

function createFakeContainer() {
  const items = [];
  return {
    items: {
      async create(entry) {
        items.push(entry);
        return { resource: entry };
      },
      query(querySpec, options) {
        const tripSlug = options?.partitionKey;
        const filtered = tripSlug ? items.filter((entry) => entry.tripSlug === tripSlug) : items.slice();
        return {
          async fetchAll() {
            return { resources: filtered };
          }
        };
      },
      readAll() {
        return {
          async fetchAll() {
            return { resources: items.slice() };
          }
        };
      }
    },
    item(id, partitionKey) {
      return {
        async read() {
          const found = items.find((entry) => entry.id === id && entry.tripSlug === partitionKey);
          return { resource: found };
        },
        async replace(body) {
          const index = items.findIndex((entry) => entry.id === id && entry.tripSlug === partitionKey);
          if (index === -1) {
            throw new Error("Entity not found.");
          }
          items[index] = body;
          return { resource: body };
        },
        async delete() {
          const index = items.findIndex((entry) => entry.id === id && entry.tripSlug === partitionKey);
          if (index === -1) {
            throw new Error("Entity not found.");
          }
          items.splice(index, 1);
        }
      };
    }
  };
}

function createFakeAuditContainer() {
  const records = [];
  return {
    records,
    items: {
      async create(record) {
        records.push(record);
        return { resource: record };
      },
      query(querySpec, options) {
        const tripSlug = options?.partitionKey;
        const filtered = tripSlug ? records.filter((record) => record.tripSlug === tripSlug) : records.slice();
        return {
          async fetchAll() {
            return { resources: filtered };
          }
        };
      },
      readAll() {
        return {
          async fetchAll() {
            return { resources: records.slice() };
          }
        };
      }
    }
  };
}

function createFakeBlobContainerClient() {
  const blobs = new Map();
  return {
    blobs,
    getBlockBlobClient(blobName) {
      return {
        async uploadData(buffer, options) {
          blobs.set(blobName, { buffer, contentType: options?.blobHTTPHeaders?.blobContentType });
        },
        async generateSasUrl(options) {
          if (!blobs.has(blobName)) {
            throw new Error("BlobNotFound");
          }
          return `https://fake.blob.core.windows.net/receipts/${blobName}?sas=fake&perm=${options?.permissions}`;
        }
      };
    },
    async deleteBlob(blobName) {
      if (!blobs.delete(blobName)) {
        throw new Error("BlobNotFound");
      }
    }
  };
}

test("normalizeExpenseInput validates and fills defaults", () => {
  const entry = store.normalizeExpenseInput({
    tripSlug: "algarve2026",
    category: "food",
    amount: "42.50",
    currency: "EUR",
    description: "Dinner"
  });

  assert.equal(entry.tripSlug, "algarve2026");
  assert.equal(entry.category, "food");
  assert.equal(entry.amount, 42.5);
  assert.equal(entry.currency, "EUR");
  assert.equal(entry.description, "Dinner");
  assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(entry.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(entry.createdBy, null);
});

test("normalizeExpenseInput rejects a zero or missing amount", () => {
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 0 }), /greater than 0/);
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: "" }), /greater than 0/);
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: -5 }), /greater than 0/);
});

test("normalizeExpenseInput accepts an optional rating in 0.5 steps between 0.5 and 5", () => {
  const entry = store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10, rating: 4 });
  assert.equal(entry.rating, 4);

  const halfStar = store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10, rating: 3.5 });
  assert.equal(halfStar.rating, 3.5);

  const entryWithoutRating = store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10 });
  assert.equal(entryWithoutRating.rating, null);
});

test("normalizeExpenseInput rejects a rating outside 0.5-5 or not a multiple of 0.5", () => {
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10, rating: 0 }), /multiple of 0.5/);
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10, rating: 5.5 }), /multiple of 0.5/);
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10, rating: 2.3 }), /multiple of 0.5/);
});

test("normalizeExpenseInput accepts an optional photos array and defaults to an empty array", () => {
  const entry = store.normalizeExpenseInput({
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    photos: [{ blobName: "algarve2026/a.jpg" }]
  });
  assert.deepEqual(entry.photos, [{ blobName: "algarve2026/a.jpg" }]);

  const entryWithoutPhotos = store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10 });
  assert.deepEqual(entryWithoutPhotos.photos, []);
});

test("normalizeExpenseInput rejects a photo without a blobName", () => {
  assert.throws(
    () =>
      store.normalizeExpenseInput({
        tripSlug: "algarve2026",
        category: "food",
        amount: 10,
        photos: [{}]
      }),
    /photos\[0\]\.blobName/
  );
});

test("normalizeExpenseInput rejects more than MAX_PHOTOS_PER_EXPENSE photos", () => {
  const photos = Array.from({ length: store.MAX_PHOTOS_PER_EXPENSE + 1 }, (_, index) => ({ blobName: `algarve2026/${index}.jpg` }));
  assert.throws(
    () => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10, photos }),
    /at most \d+ items/
  );
});

test("normalizeExpenseInput accepts an optional entry-level location and defaults to null", () => {
  const entry = store.normalizeExpenseInput({
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    location: { latitude: 38.7223, longitude: -9.1393 }
  });
  assert.deepEqual(entry.location, { latitude: 38.7223, longitude: -9.1393 });

  const entryWithoutLocation = store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 10 });
  assert.equal(entryWithoutLocation.location, null);
});

test("normalizeExpenseInput rejects a location with coordinates outside valid ranges", () => {
  assert.throws(
    () =>
      store.normalizeExpenseInput({
        tripSlug: "algarve2026",
        category: "food",
        amount: 10,
        location: { latitude: 91, longitude: 0 }
      }),
    /location\.latitude/
  );
  assert.throws(
    () =>
      store.normalizeExpenseInput({
        tripSlug: "algarve2026",
        category: "food",
        amount: 10,
        location: { latitude: 0, longitude: -181 }
      }),
    /location\.longitude/
  );
});

test("normalizeExpenseInput records the actor as createdBy when provided", () => {
  const entry = store.normalizeExpenseInput(
    { tripSlug: "algarve2026", category: "food", amount: 10 },
    { userId: "u1", userDetails: "eduardo.oliveira", identityProvider: "github", userRoles: ["approved"] }
  );

  assert.deepEqual(entry.createdBy, { userId: "u1", userDetails: "eduardo.oliveira" });
});

test("store persists and filters expenses by tripSlug", async () => {
  const fakeContainer = createFakeContainer();
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: fakeContainer, auditContainer: fakeAuditContainer });
  const actor = { userId: "u1", userDetails: "eduardo.oliveira" };

  const first = await expenseStore.addEntry(
    {
      tripSlug: "algarve2026",
      category: "food",
      amount: 12.34,
      currency: "EUR",
      date: "2026-09-14",
      description: "Lunch"
    },
    actor
  );
  const second = await expenseStore.addEntry({
    tripSlug: "el-gouna2027",
    category: "food",
    amount: 22,
    currency: "EUR",
    date: "2027-01-24",
    description: "Dinner"
  });

  assert.ok(first.id);
  assert.ok(second.id);
  assert.deepEqual(first.createdBy, actor);

  const all = await expenseStore.listEntries();
  assert.equal(all.length, 2);

  const filtered = await expenseStore.listEntries("algarve2026");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].tripSlug, "algarve2026");
  assert.equal(filtered[0].amount, 12.34);

  await expenseStore.removeEntry("algarve2026", first.id, actor);
  const afterRemoval = await expenseStore.listEntries();
  assert.equal(afterRemoval.length, 1);
  assert.equal(afterRemoval[0].id, second.id);

  assert.equal(fakeAuditContainer.records.length, 3);
  assert.deepEqual(
    fakeAuditContainer.records.map((record) => record.action),
    ["create", "create", "delete"]
  );
  const deleteRecord = fakeAuditContainer.records.find((record) => record.action === "delete");
  assert.equal(deleteRecord.expenseId, first.id);
  assert.equal(deleteRecord.tripSlug, "algarve2026");
  assert.deepEqual(deleteRecord.actor, actor);
});

test("updateEntry replaces fields but keeps id, tripSlug and createdAt", async () => {
  const fakeContainer = createFakeContainer();
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: fakeContainer, auditContainer: fakeAuditContainer });

  const created = await expenseStore.addEntry({ tripSlug: "algarve2026", category: "food", amount: 10, description: "Lunch" });

  const updated = await expenseStore.updateEntry(
    "algarve2026",
    created.id,
    { tripSlug: "algarve2026", category: "food", amount: 15.5, description: "Dinner", rating: 3.5 },
    { userId: "u1", userDetails: "eduardo.oliveira" }
  );

  assert.equal(updated.id, created.id);
  assert.equal(updated.tripSlug, "algarve2026");
  assert.equal(updated.amount, 15.5);
  assert.equal(updated.description, "Dinner");
  assert.equal(updated.rating, 3.5);
  assert.equal(updated.createdAt, created.createdAt);

  const entries = await expenseStore.listEntries("algarve2026");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 15.5);

  assert.deepEqual(
    fakeAuditContainer.records.map((record) => record.action),
    ["create", "update"]
  );
});

test("updateEntry rejects an id that does not exist", async () => {
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: createFakeAuditContainer() });

  await assert.rejects(
    () => expenseStore.updateEntry("algarve2026", "missing-id", { tripSlug: "algarve2026", category: "food", amount: 10 }),
    /not found/
  );
});

test("updateEntry deletes only the photo blobs that are no longer referenced", async () => {
  const fakeBlobContainer = createFakeBlobContainerClient();
  const expenseStore = store.createExpenseStore({
    container: createFakeContainer(),
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: fakeBlobContainer
  });

  const { blobName: blobA } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("a"), "image/jpeg");
  const { blobName: blobB } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("b"), "image/jpeg");
  const { blobName: blobC } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("c"), "image/jpeg");
  const entry = await expenseStore.addEntry({
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    photos: [{ blobName: blobA }, { blobName: blobB }]
  });

  const updated = await expenseStore.updateEntry("algarve2026", entry.id, {
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    photos: [{ blobName: blobB }, { blobName: blobC }]
  });

  assert.deepEqual(
    updated.photos.map((photo) => photo.blobName),
    [blobB, blobC]
  );
  assert.equal(fakeBlobContainer.blobs.has(blobA), false);
  assert.equal(fakeBlobContainer.blobs.has(blobB), true);
  assert.equal(fakeBlobContainer.blobs.has(blobC), true);
});

test("updateEntry deletes the previous photo blob when all photos are removed", async () => {
  const fakeBlobContainer = createFakeBlobContainerClient();
  const expenseStore = store.createExpenseStore({
    container: createFakeContainer(),
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: fakeBlobContainer
  });

  const { blobName } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("old"), "image/jpeg");
  const entry = await expenseStore.addEntry({
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    photos: [{ blobName }]
  });

  const updated = await expenseStore.updateEntry("algarve2026", entry.id, {
    tripSlug: "algarve2026",
    category: "food",
    amount: 10
  });

  assert.deepEqual(updated.photos, []);
  assert.equal(fakeBlobContainer.blobs.has(blobName), false);
});

test("updateEntry migrates a legacy single-photo entry to the photos array and drops the old fields", async () => {
  const fakeContainer = createFakeContainer();
  const fakeBlobContainer = createFakeBlobContainerClient();
  const expenseStore = store.createExpenseStore({
    container: fakeContainer,
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: fakeBlobContainer
  });

  const { blobName: oldBlob } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("old"), "image/jpeg");
  const { blobName: newBlob } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("new"), "image/jpeg");
  await fakeContainer.items.create({
    id: "legacy-1",
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    receiptBlobName: oldBlob,
    photoLocation: { latitude: 1, longitude: 2 },
    createdAt: new Date().toISOString()
  });

  const updated = await expenseStore.updateEntry("algarve2026", "legacy-1", {
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    photos: [{ blobName: newBlob }]
  });

  assert.deepEqual(
    updated.photos.map((photo) => photo.blobName),
    [newBlob]
  );
  assert.equal("receiptBlobName" in updated, false);
  assert.equal("photoLocation" in updated, false);
  assert.equal(updated.location, null);
  assert.equal(fakeBlobContainer.blobs.has(oldBlob), false);
});

test("uploadReceipt stores the image under tripSlug/ and returns a blob name", async () => {
  const fakeBlobContainer = createFakeBlobContainerClient();
  const expenseStore = store.createExpenseStore({
    container: createFakeContainer(),
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: fakeBlobContainer
  });

  const result = await expenseStore.uploadReceipt("algarve2026", Buffer.from("fake-image-bytes"), "image/jpeg");

  assert.match(result.blobName, /^algarve2026\/[a-f0-9-]+\.jpg$/);
  assert.ok(fakeBlobContainer.blobs.has(result.blobName));
  assert.equal(fakeBlobContainer.blobs.get(result.blobName).contentType, "image/jpeg");
});

test("uploadReceipt rejects an unsupported content type", async () => {
  const expenseStore = store.createExpenseStore({
    container: createFakeContainer(),
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: createFakeBlobContainerClient()
  });

  await assert.rejects(() => expenseStore.uploadReceipt("algarve2026", Buffer.from("x"), "application/pdf"), /Unsupported receipt content type/);
});

test("listEntries attaches a url to every photo of an entry", async () => {
  const fakeBlobContainer = createFakeBlobContainerClient();
  const expenseStore = store.createExpenseStore({
    container: createFakeContainer(),
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: fakeBlobContainer
  });

  const { blobName: blobA } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("a"), "image/jpeg");
  const { blobName: blobB } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("b"), "image/jpeg");
  await expenseStore.addEntry({
    tripSlug: "algarve2026",
    category: "food",
    amount: 20,
    photos: [{ blobName: blobA }, { blobName: blobB }],
    rating: 5
  });
  await expenseStore.addEntry({ tripSlug: "algarve2026", category: "food", amount: 5 });

  const entries = await expenseStore.listEntries("algarve2026");
  const withPhotos = entries.find((entry) => entry.photos.length > 0);
  const withoutPhotos = entries.find((entry) => entry.photos.length === 0);

  assert.equal(withPhotos.photos.length, 2);
  assert.ok(withPhotos.photos.every((photo) => photo.url.startsWith("https://")));
  assert.equal(withPhotos.rating, 5);
  assert.deepEqual(withoutPhotos.photos, []);
});

test("listEntries synthesizes a photos array from legacy receiptBlobName/photoLocation fields", async () => {
  const fakeContainer = createFakeContainer();
  const fakeBlobContainer = createFakeBlobContainerClient();
  const expenseStore = store.createExpenseStore({
    container: fakeContainer,
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: fakeBlobContainer
  });

  const { blobName } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("img"), "image/jpeg");
  await fakeContainer.items.create({
    id: "legacy-1",
    tripSlug: "algarve2026",
    category: "food",
    amount: 10,
    receiptBlobName: blobName,
    photoLocation: { latitude: 1, longitude: 2 },
    createdAt: new Date().toISOString()
  });

  const entries = await expenseStore.listEntries("algarve2026");
  const legacyEntry = entries.find((entry) => entry.id === "legacy-1");

  assert.deepEqual(
    legacyEntry.photos.map((photo) => photo.blobName),
    [blobName]
  );
  assert.ok(legacyEntry.photos[0].url.startsWith("https://"));
  assert.deepEqual(legacyEntry.location, { latitude: 1, longitude: 2 });
});

test("removeEntry deletes all of an entry's photo blobs", async () => {
  const fakeBlobContainer = createFakeBlobContainerClient();
  const expenseStore = store.createExpenseStore({
    container: createFakeContainer(),
    auditContainer: createFakeAuditContainer(),
    blobContainerClient: fakeBlobContainer
  });

  const { blobName: blobA } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("a"), "image/jpeg");
  const { blobName: blobB } = await expenseStore.uploadReceipt("algarve2026", Buffer.from("b"), "image/jpeg");
  const entry = await expenseStore.addEntry({
    tripSlug: "algarve2026",
    category: "food",
    amount: 20,
    photos: [{ blobName: blobA }, { blobName: blobB }]
  });

  await expenseStore.removeEntry("algarve2026", entry.id, null);

  assert.equal(fakeBlobContainer.blobs.has(blobA), false);
  assert.equal(fakeBlobContainer.blobs.has(blobB), false);
});

test("removeEntry succeeds even when a photo blob is missing, and still records the audit entry", async () => {
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({
    container: createFakeContainer(),
    auditContainer: fakeAuditContainer,
    blobContainerClient: createFakeBlobContainerClient()
  });
  const entry = await expenseStore.addEntry({
    tripSlug: "algarve2026",
    category: "food",
    amount: 20,
    photos: [{ blobName: "algarve2026/nonexistent-blob.jpg" }]
  });

  await assert.doesNotReject(() => expenseStore.removeEntry("algarve2026", entry.id, null));

  const deleteRecord = fakeAuditContainer.records.find((record) => record.action === "delete");
  assert.equal(deleteRecord.expenseId, entry.id);
});

test("listAuditEntries returns an empty page when nothing has been recorded", async () => {
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: createFakeAuditContainer() });
  const result = await expenseStore.listAuditEntries();

  assert.deepEqual(result.entries, []);
  assert.equal(result.total, 0);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 10);
  assert.equal(result.totalPages, 1);
});

test("listAuditEntries sorts by most recent first and strips Cosmos metadata", async () => {
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: fakeAuditContainer });

  fakeAuditContainer.records.push(
    { id: "a1", action: "create", expenseId: "e1", tripSlug: "algarve2026", actor: null, at: "2026-09-01T10:00:00.000Z", _rid: "r1", _etag: "t1" },
    { id: "a2", action: "create", expenseId: "e2", tripSlug: "el-gouna2027", actor: null, at: "2026-09-02T10:00:00.000Z" },
    {
      id: "a3",
      action: "delete",
      expenseId: "e1",
      tripSlug: "algarve2026",
      actor: { userId: "u1", userDetails: "eduardo.oliveira" },
      at: "2026-09-03T10:00:00.000Z"
    }
  );

  const result = await expenseStore.listAuditEntries();

  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["a3", "a2", "a1"]
  );
  assert.equal(result.entries[2]._rid, undefined);
  assert.deepEqual(result.entries[0].actor, { userId: "u1", userDetails: "eduardo.oliveira" });
  assert.equal(result.total, 3);
  assert.equal(result.totalPages, 1);
});

test("listAuditEntries filters by tripSlug", async () => {
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: fakeAuditContainer });

  fakeAuditContainer.records.push(
    { id: "a1", action: "create", expenseId: "e1", tripSlug: "algarve2026", actor: null, at: "2026-09-01T10:00:00.000Z" },
    { id: "a2", action: "create", expenseId: "e2", tripSlug: "el-gouna2027", actor: null, at: "2026-09-02T10:00:00.000Z" }
  );

  const result = await expenseStore.listAuditEntries("algarve2026");

  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["a1"]
  );
  assert.equal(result.total, 1);
});

test("listAuditEntries paginates results using page and pageSize", async () => {
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: fakeAuditContainer });

  for (let i = 1; i <= 5; i += 1) {
    fakeAuditContainer.records.push({
      id: `a${i}`,
      action: "create",
      expenseId: `e${i}`,
      tripSlug: "algarve2026",
      actor: null,
      at: `2026-09-0${i}T10:00:00.000Z`
    });
  }

  const firstPage = await expenseStore.listAuditEntries(null, { page: 1, pageSize: 2 });
  assert.deepEqual(
    firstPage.entries.map((entry) => entry.id),
    ["a5", "a4"]
  );
  assert.equal(firstPage.total, 5);
  assert.equal(firstPage.totalPages, 3);

  const secondPage = await expenseStore.listAuditEntries(null, { page: 2, pageSize: 2 });
  assert.deepEqual(
    secondPage.entries.map((entry) => entry.id),
    ["a3", "a2"]
  );

  const lastPage = await expenseStore.listAuditEntries(null, { page: 3, pageSize: 2 });
  assert.deepEqual(
    lastPage.entries.map((entry) => entry.id),
    ["a1"]
  );

  const pastLastPage = await expenseStore.listAuditEntries(null, { page: 4, pageSize: 2 });
  assert.deepEqual(pastLastPage.entries, []);
  assert.equal(pastLastPage.total, 5);
  assert.equal(pastLastPage.totalPages, 3);
});
