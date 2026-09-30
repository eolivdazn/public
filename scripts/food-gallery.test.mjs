import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

// trip-food-gallery.js is a plain browser script (no module syntax). Run it in a vm context that
// provides `module`, which makes it export its pure helpers instead of wiring up the DOM.
const source = fs.readFileSync(fileURLToPath(new URL("./templates/trip-food-gallery.js", import.meta.url)), "utf-8");
const sandbox = { module: { exports: {} } };
vm.runInNewContext(source, sandbox);
const gallery = sandbox.module.exports;

// Arrays/objects created inside the vm context have that context's prototypes, which strict
// deepEqual treats as different; compare their plain-data form instead.
const plain = (value) => JSON.parse(JSON.stringify(value));

function entry(overrides) {
  return {
    id: "e1",
    category: "food",
    date: "2026-10-17",
    createdAt: "2026-10-17T20:00:00Z",
    description: "Paella",
    rating: null,
    photos: [{ blobName: "valencia2026/a.jpg", url: "https://blob.test/a.jpg" }],
    ...overrides
  };
}

test("galleryEntries keeps only food expenses with at least one photo URL, in trip order", () => {
  const result = gallery.galleryEntries([
    entry({ id: "late", date: "2026-10-18" }),
    entry({ id: "hotel", category: "hotel" }),
    entry({ id: "no-photos", photos: [] }),
    entry({ id: "no-url", photos: [{ blobName: "valencia2026/x.jpg", url: null }] }),
    entry({ id: "second", createdAt: "2026-10-17T21:00:00Z" }),
    entry({ id: "first", createdAt: "2026-10-17T13:00:00Z" })
  ]);
  assert.deepEqual(
    result.map((item) => item.id),
    ["first", "second", "late"]
  );
});

test("galleryEntries drops photos without a URL but keeps the entry's usable ones", () => {
  const [result] = gallery.galleryEntries([
    entry({ photos: [{ url: null }, { url: "https://blob.test/b.jpg" }] })
  ]);
  assert.deepEqual(
    result.photos.map((photo) => photo.url),
    ["https://blob.test/b.jpg"]
  );
});

test("galleryEntries tolerates a missing or empty API response", () => {
  assert.deepEqual(plain(gallery.galleryEntries(undefined)), []);
  assert.deepEqual(plain(gallery.galleryEntries([])), []);
});

test("groupEntriesByDay groups consecutive entries by date", () => {
  const groups = gallery.groupEntriesByDay([
    entry({ id: "a", date: "2026-10-17" }),
    entry({ id: "b", date: "2026-10-17" }),
    entry({ id: "c", date: "2026-10-18" })
  ]);
  assert.deepEqual(
    plain(groups.map((group) => [group.date, group.entries.map((item) => item.id)])),
    [
      ["2026-10-17", ["a", "b"]],
      ["2026-10-18", ["c"]]
    ]
  );
});

test("flattenPhotos lists every photo in display order with its position", () => {
  const photos = gallery.flattenPhotos([
    entry({ id: "a", photos: [{ url: "u1" }, { url: "u2" }] }),
    entry({ id: "b", photos: [{ url: "u3" }] })
  ]);
  assert.deepEqual(
    plain(photos.map((photo) => [photo.url, photo.entry.id, photo.photoIndex, photo.index])),
    [
      ["u1", "a", 0, 0],
      ["u2", "a", 1, 1],
      ["u3", "b", 0, 2]
    ]
  );
});

test("formatDayLabel formats the day without shifting it by timezone", () => {
  assert.equal(gallery.formatDayLabel("2026-10-17"), "Sat 17 Oct");
  assert.equal(gallery.formatDayLabel("2027-01-01"), "Fri 1 Jan");
  assert.equal(gallery.formatDayLabel(""), "Undated");
  assert.equal(gallery.formatDayLabel("not-a-date"), "Undated");
});

test("cardLabel names the action, the dish, the photo count and the rating", () => {
  assert.equal(gallery.cardLabel(entry({})), "Open photo: Paella");
  assert.equal(
    gallery.cardLabel(entry({ rating: 4.5, photos: [{ url: "a" }, { url: "b" }, { url: "c" }] })),
    "Open 3 photos: Paella, rated 4.5 out of 5"
  );
  assert.equal(gallery.cardLabel(entry({ description: null })), "Open photo: Dish");
});

test("summaryLabel counts photos (not items) and days with correct plurals", () => {
  assert.equal(gallery.summaryLabel([entry({})]), "1 photo · 1 day");
  assert.equal(
    gallery.summaryLabel([
      entry({ id: "a", photos: [{ url: "u1" }, { url: "u2" }] }),
      entry({ id: "b" }),
      entry({ id: "c", date: "2026-10-18" })
    ]),
    "4 photos · 2 days"
  );
});

function tripPhoto(overrides) {
  return {
    id: "p1",
    docType: "tripPhoto",
    tripSlug: "valencia2026",
    caption: "Sunset",
    takenOn: "2026-10-17",
    location: { latitude: 39.47, longitude: -0.32 },
    createdBy: { userId: "u1", userDetails: "eduardo" },
    createdAt: "2026-10-18T09:00:00Z",
    url: "https://blob.test/p1.jpg",
    ...overrides
  };
}

test("tripPhotoItems turns photos into gallery items dated by their EXIF day, else the day they were added", () => {
  const items = plain(
    gallery.tripPhotoItems([
      tripPhoto({ id: "exif" }),
      tripPhoto({ id: "no-exif", takenOn: null, createdAt: "2026-10-19T08:00:00Z", caption: null }),
      tripPhoto({ id: "no-url", url: null })
    ])
  );
  assert.deepEqual(
    items.map((item) => [item.id, item.kind, item.date, item.description, item.photos.length]),
    [
      ["exif", "trip", "2026-10-17", "Sunset", 1],
      ["no-exif", "trip", "2026-10-19", null, 1]
    ]
  );
  assert.deepEqual(items[0].createdBy, { userId: "u1", userDetails: "eduardo" });
  assert.equal(items[0].rating, null);
});

test("galleryItems merges food and trip photos in trip order, and filterItems narrows by kind", () => {
  const items = gallery.galleryItems(
    [entry({ id: "lunch", date: "2026-10-17", createdAt: "2026-10-17T13:00:00Z" }), entry({ id: "hotel", category: "hotel" })],
    [
      tripPhoto({ id: "morning", takenOn: "2026-10-17", createdAt: "2026-10-17T09:00:00Z" }),
      tripPhoto({ id: "next-day", takenOn: "2026-10-18" })
    ]
  );
  assert.deepEqual(plain(items.map((item) => [item.id, item.kind])), [
    ["morning", "trip"],
    ["lunch", "food"],
    ["next-day", "trip"]
  ]);
  assert.deepEqual(plain(gallery.filterItems(items, "trip").map((item) => item.id)), ["morning", "next-day"]);
  assert.deepEqual(plain(gallery.filterItems(items, "food").map((item) => item.id)), ["lunch"]);
  assert.equal(gallery.filterItems(items, "all").length, 3);
  assert.deepEqual(plain(gallery.galleryItems(undefined, undefined)), []);
});

test("cardLabel names trip photos by caption, or as a trip photo without one", () => {
  const [captioned, bare] = gallery.tripPhotoItems([tripPhoto({ id: "a" }), tripPhoto({ id: "b", caption: null })]);
  assert.equal(gallery.cardLabel(captioned), "Open photo: Sunset");
  assert.equal(gallery.cardLabel(bare), "Open photo: Trip photo");
});
