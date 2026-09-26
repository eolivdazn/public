import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

// See expenses-handler.test.js for why this uses require.cache injection instead of vi.mock.
const require = createRequire(import.meta.url);
const storeModulePath = require.resolve("../../lib/expense-store");
const handlerModulePath = require.resolve("../../audit/index.js");

const mockStore = {
  listAuditEntries: vi.fn()
};

describe("audit API handler", () => {
  let auditApi;

  beforeEach(() => {
    vi.clearAllMocks();
    require.cache[storeModulePath] = { id: storeModulePath, filename: storeModulePath, loaded: true, exports: mockStore };
    delete require.cache[handlerModulePath];
    auditApi = require("../../audit/index.js");
  });

  afterEach(() => {
    delete require.cache[storeModulePath];
    delete require.cache[handlerModulePath];
  });

  it("GET returns paginated entries with default paging", async () => {
    mockStore.listAuditEntries.mockResolvedValue({ entries: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
    const context = {};

    await auditApi(context, { method: "GET", query: {} });

    expect(mockStore.listAuditEntries).toHaveBeenCalledWith(null, { page: 1, pageSize: 10 });
    expect(context.res.status).toBe(200);
    expect(context.res.body.tripSlug).toBeNull();
  });

  it("clamps pageSize to the configured maximum", async () => {
    mockStore.listAuditEntries.mockResolvedValue({ entries: [], total: 0, page: 1, pageSize: 100, totalPages: 1 });
    const context = {};

    await auditApi(context, { method: "GET", query: { pageSize: "9999" } });

    expect(mockStore.listAuditEntries).toHaveBeenCalledWith(null, { page: 1, pageSize: 100 });
  });

  it("returns 405 for a non-GET method", async () => {
    const context = {};

    await auditApi(context, { method: "POST", query: {} });

    expect(context.res.status).toBe(405);
    expect(context.res.headers.Allow).toBe("GET");
  });

  it("maps a thrown store error to a 400", async () => {
    mockStore.listAuditEntries.mockRejectedValue(new Error("boom"));
    const context = {};

    await auditApi(context, { method: "GET", query: {} });

    expect(context.res.status).toBe(400);
    expect(context.res.body.error).toBe("boom");
  });
});
