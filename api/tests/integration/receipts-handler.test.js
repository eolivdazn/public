import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

// See expenses-handler.test.js for why this uses require.cache injection instead of vi.mock.
const require = createRequire(import.meta.url);
const storeModulePath = require.resolve("../../lib/expense-store");
const handlerModulePath = require.resolve("../../receipts/index.js");

const mockStore = {
  uploadReceipt: vi.fn(),
  RECEIPT_CONTENT_TYPES: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
};

describe("receipts API handler", () => {
  let receiptsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    require.cache[storeModulePath] = { id: storeModulePath, filename: storeModulePath, loaded: true, exports: mockStore };
    delete require.cache[handlerModulePath];
    receiptsApi = require("../../receipts/index.js");
  });

  afterEach(() => {
    delete require.cache[storeModulePath];
    delete require.cache[handlerModulePath];
  });

  it("uploads a valid base64 image and returns 201 with the blob name", async () => {
    mockStore.uploadReceipt.mockResolvedValue({ blobName: "trip-a/abc.jpg" });
    const context = {};

    await receiptsApi(context, {
      method: "POST",
      query: { tripSlug: "trip-a" },
      body: { contentType: "image/jpeg", data: Buffer.from("fake-image-bytes").toString("base64") }
    });

    expect(mockStore.uploadReceipt).toHaveBeenCalledWith("trip-a", expect.any(Buffer), "image/jpeg");
    expect(context.res.status).toBe(201);
    expect(context.res.body.blobName).toBe("trip-a/abc.jpg");
  });

  it("rejects a missing tripSlug with 400 before touching the store", async () => {
    const context = {};

    await receiptsApi(context, { method: "POST", query: {}, body: { contentType: "image/jpeg", data: "abc" } });

    expect(context.res.status).toBe(400);
    expect(mockStore.uploadReceipt).not.toHaveBeenCalled();
  });

  it("rejects an unsupported content type with 400", async () => {
    const context = {};

    await receiptsApi(context, {
      method: "POST",
      query: { tripSlug: "trip-a" },
      body: { contentType: "application/pdf", data: "abc" }
    });

    expect(context.res.status).toBe(400);
    expect(mockStore.uploadReceipt).not.toHaveBeenCalled();
  });

  it("returns 405 for a non-POST method", async () => {
    const context = {};

    await receiptsApi(context, { method: "GET", query: {} });

    expect(context.res.status).toBe(405);
    expect(context.res.headers.Allow).toBe("POST");
  });
});
