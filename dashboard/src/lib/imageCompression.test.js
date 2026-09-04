import test from "node:test";
import assert from "node:assert/strict";
import { validateReceiptFile } from "./imageCompression.js";

test("validateReceiptFile accepts allowed image types under the size limit", () => {
  assert.deepEqual(validateReceiptFile({ type: "image/jpeg", size: 1024 }), { valid: true, error: null });
  assert.deepEqual(validateReceiptFile({ type: "image/png", size: 1024 }), { valid: true, error: null });
  assert.deepEqual(validateReceiptFile({ type: "image/webp", size: 1024 }), { valid: true, error: null });
});

test("validateReceiptFile rejects a missing file", () => {
  assert.equal(validateReceiptFile(null).valid, false);
  assert.equal(validateReceiptFile(undefined).valid, false);
});

test("validateReceiptFile rejects unsupported mime types", () => {
  const result = validateReceiptFile({ type: "application/pdf", size: 1024 });
  assert.equal(result.valid, false);
  assert.match(result.error, /JPEG, PNG or WEBP/);
});

test("validateReceiptFile rejects files larger than 15MB", () => {
  const result = validateReceiptFile({ type: "image/png", size: 16 * 1024 * 1024 });
  assert.equal(result.valid, false);
  assert.match(result.error, /smaller than/);
});
