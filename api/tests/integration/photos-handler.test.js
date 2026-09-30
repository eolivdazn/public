import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

// See expenses-handler.test.js for why this uses require.cache injection instead of vi.mock.
const require = createRequire(import.meta.url);
const storeModulePath = require.resolve("../../lib/photo-store");
const handlerModulePath = require.resolve("../../photos/index.js");

const mockStore = {
  listPhotos: vi.fn(),
  addPhoto: vi.fn(),
  removePhoto: vi.fn()
};

const principal = Buffer.from(JSON.stringify({ userId: "u1", userDetails: "eduardo", userRoles: ["approved"] })).toString("base64");

describe("photos API handler", () => {
  let photosApi;

  beforeEach(() => {
    vi.clearAllMocks();
    require.cache[storeModulePath] = { id: storeModulePath, filename: storeModulePath, loaded: true, exports: mockStore };
    delete require.cache[handlerModulePath];
    photosApi = require("../../photos/index.js");
  });

  afterEach(() => {
    delete require.cache[storeModulePath];
    delete require.cache[handlerModulePath];
  });

  it("lists a trip's photos", async () => {
    mockStore.listPhotos.mockResolvedValue([{ id: "p1", url: "https://blob/p1" }]);
    const context = {};

    await photosApi(context, { method: "GET", query: { tripSlug: " valencia2026 " }, headers: {} });

    expect(mockStore.listPhotos).toHaveBeenCalledWith("valencia2026");
    expect(context.res.status).toBe(200);
    expect(context.res.body).toEqual({ tripSlug: "valencia2026", count: 1, photos: [{ id: "p1", url: "https://blob/p1" }] });
  });

  it("requires tripSlug to list photos", async () => {
    const context = {};
    await photosApi(context, { method: "GET", query: {}, headers: {} });
    expect(context.res.status).toBe(400);
    expect(mockStore.listPhotos).not.toHaveBeenCalled();
  });

  it("adds a photo as the signed-in user and returns 201", async () => {
    mockStore.addPhoto.mockResolvedValue({ id: "p1", caption: "Beach" });
    const context = {};
    const body = { tripSlug: "valencia2026", blobName: "valencia2026/p1.jpg", caption: "Beach" };

    await photosApi(context, { method: "POST", query: {}, headers: { "x-ms-client-principal": principal }, body: JSON.stringify(body) });

    expect(mockStore.addPhoto).toHaveBeenCalledWith(body, expect.objectContaining({ userId: "u1", userDetails: "eduardo" }));
    expect(context.res.status).toBe(201);
    expect(context.res.body.photo).toEqual({ id: "p1", caption: "Beach" });
  });

  it("returns 400 with the validation message when the store rejects a photo", async () => {
    mockStore.addPhoto.mockRejectedValue(new Error("'blobName' is not an image uploaded for trip 'valencia2026'."));
    const context = {};

    await photosApi(context, { method: "POST", query: {}, headers: {}, body: { tripSlug: "valencia2026", blobName: "x.jpg" } });

    expect(context.res.status).toBe(400);
    expect(context.res.body.error).toMatch(/not an image uploaded/);
  });

  it("deletes a photo by id and tripSlug", async () => {
    mockStore.removePhoto.mockResolvedValue();
    const context = {};

    await photosApi(context, { method: "DELETE", query: { id: "p1", tripSlug: "valencia2026" }, headers: { "x-ms-client-principal": principal } });

    expect(mockStore.removePhoto).toHaveBeenCalledWith("valencia2026", "p1", expect.objectContaining({ userId: "u1" }));
    expect(context.res.status).toBe(200);
  });

  it("requires id and tripSlug to delete", async () => {
    const context = {};
    await photosApi(context, { method: "DELETE", query: { id: "p1" }, headers: {} });
    expect(context.res.status).toBe(400);
    expect(mockStore.removePhoto).not.toHaveBeenCalled();
  });

  it("rejects other methods with 405 and an Allow header", async () => {
    const context = {};
    await photosApi(context, { method: "PUT", query: {}, headers: {} });
    expect(context.res.status).toBe(405);
    expect(context.res.headers.Allow).toBe("GET, POST, DELETE");
  });
});
