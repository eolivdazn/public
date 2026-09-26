import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

// The handler (api/expenses/index.js) is plain legacy CommonJS — no import/export syntax for
// Vite to rewrite — so vi.mock()'s normal AST-based interception never reaches its internal
// require("../lib/expense-store") call; that require resolves through Node's own, unmocked
// module cache regardless of how this test file loads the handler (static or dynamic import).
// Injecting the mock directly into require.cache is plain Node semantics and sidesteps the
// Vite/Vitest ESM-graph boundary entirely.
const require = createRequire(import.meta.url);
const storeModulePath = require.resolve("../../lib/expense-store");
const handlerModulePath = require.resolve("../../expenses/index.js");

const mockStore = {
  addEntry: vi.fn(),
  listEntries: vi.fn(),
  updateEntry: vi.fn(),
  removeEntry: vi.fn()
};

describe("expenses API handler", () => {
  let expensesApi;

  beforeEach(() => {
    vi.clearAllMocks();
    require.cache[storeModulePath] = { id: storeModulePath, filename: storeModulePath, loaded: true, exports: mockStore };
    delete require.cache[handlerModulePath];
    expensesApi = require("../../expenses/index.js");
  });

  afterEach(() => {
    delete require.cache[storeModulePath];
    delete require.cache[handlerModulePath];
  });

  it("GET lists entries, optionally filtered by tripSlug", async () => {
    mockStore.listEntries.mockResolvedValue([{ id: "1", tripSlug: "trip-a" }]);
    const context = {};

    await expensesApi(context, { method: "GET", query: { tripSlug: "trip-a" }, headers: {} });

    expect(mockStore.listEntries).toHaveBeenCalledWith("trip-a");
    expect(context.res.status).toBe(200);
    expect(context.res.body).toEqual({ tripSlug: "trip-a", count: 1, entries: [{ id: "1", tripSlug: "trip-a" }] });
  });

  it("POST creates an entry and returns 201 with the created entry", async () => {
    mockStore.addEntry.mockResolvedValue({ id: "1", tripSlug: "trip-a" });
    mockStore.listEntries.mockResolvedValue([{ id: "1", tripSlug: "trip-a", category: "food" }]);
    const context = {};

    await expensesApi(context, {
      method: "POST",
      query: {},
      headers: {},
      body: { tripSlug: "trip-a", category: "food", amount: 10 }
    });

    expect(mockStore.addEntry).toHaveBeenCalledWith({ tripSlug: "trip-a", category: "food", amount: 10 }, null);
    expect(context.res.status).toBe(201);
    expect(context.res.body.entry).toEqual({ id: "1", tripSlug: "trip-a", category: "food" });
  });

  it("PUT without id/tripSlug query params returns 400 without touching the store", async () => {
    const context = {};

    await expensesApi(context, { method: "PUT", query: {}, headers: {}, body: {} });

    expect(context.res.status).toBe(400);
    expect(mockStore.updateEntry).not.toHaveBeenCalled();
  });

  it("DELETE without id/tripSlug query params returns 400 without touching the store", async () => {
    const context = {};

    await expensesApi(context, { method: "DELETE", query: {}, headers: {} });

    expect(context.res.status).toBe(400);
    expect(mockStore.removeEntry).not.toHaveBeenCalled();
  });

  it("returns 405 with an Allow header for an unsupported method", async () => {
    const context = {};

    await expensesApi(context, { method: "PATCH", query: {}, headers: {} });

    expect(context.res.status).toBe(405);
    expect(context.res.headers.Allow).toBe("GET, POST, PUT, DELETE");
  });

  it("maps a thrown store validation error to a 400 with its message", async () => {
    mockStore.addEntry.mockRejectedValue(new Error("'category' is required."));
    const context = {};

    await expensesApi(context, { method: "POST", query: {}, headers: {}, body: {} });

    expect(context.res.status).toBe(400);
    expect(context.res.body.error).toBe("'category' is required.");
  });
});
