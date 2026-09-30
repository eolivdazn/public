import test from "node:test";
import assert from "node:assert/strict";
import { extractPhotoTakenOn, formatTakenOn } from "./geolocation.js";

test("formatTakenOn keeps the photo's local calendar day", () => {
  // EXIF "2026:10:17 23:40:00" (no time zone) becomes a local-time Date; late evening must stay on the 17th.
  assert.equal(formatTakenOn(new Date(2026, 9, 17, 23, 40)), "2026-10-17");
  assert.equal(formatTakenOn(new Date(2027, 0, 5, 0, 5)), "2027-01-05");
  assert.equal(formatTakenOn(new Date("not a date")), null);
  assert.equal(formatTakenOn(undefined), null);
});

test("extractPhotoTakenOn reads DateTimeOriginal, falling back to CreateDate", async () => {
  const withOriginal = async () => ({ DateTimeOriginal: new Date(2026, 9, 17, 13, 10), CreateDate: new Date(2026, 9, 20) });
  assert.equal(await extractPhotoTakenOn({}, { parseExif: withOriginal }), "2026-10-17");

  const onlyCreate = async () => ({ CreateDate: new Date(2026, 9, 18, 9, 0) });
  assert.equal(await extractPhotoTakenOn({}, { parseExif: onlyCreate }), "2026-10-18");
});

test("extractPhotoTakenOn returns null when the photo has no usable EXIF date", async () => {
  assert.equal(await extractPhotoTakenOn({}, { parseExif: async () => undefined }), null);
  assert.equal(await extractPhotoTakenOn({}, { parseExif: async () => ({ DateTimeOriginal: "garbage" }) }), null);
  assert.equal(
    await extractPhotoTakenOn({}, {
      parseExif: async () => {
        throw new Error("Unknown file format");
      }
    }),
    null
  );
});
