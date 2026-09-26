import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

// See expenses-handler.test.js for why this uses require.cache injection instead of vi.mock.
const require = createRequire(import.meta.url);
const storeModulePath = require.resolve("../../lib/expense-store");
const aiModulePath = require.resolve("../../lib/ai-suggestions");
const handlerModulePath = require.resolve("../../suggestions/index.js");

const mockStore = {
  RECEIPT_CONTENT_TYPES: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
};

const mockAi = {
  requestFoodDescriptionSuggestion: vi.fn(),
  isAiSuggestionsEnabled: vi.fn()
};

describe("suggestions API handler", () => {
  let suggestionsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    require.cache[storeModulePath] = { id: storeModulePath, filename: storeModulePath, loaded: true, exports: mockStore };
    require.cache[aiModulePath] = { id: aiModulePath, filename: aiModulePath, loaded: true, exports: mockAi };
    delete require.cache[handlerModulePath];
    suggestionsApi = require("../../suggestions/index.js");
  });

  afterEach(() => {
    delete require.cache[storeModulePath];
    delete require.cache[aiModulePath];
    delete require.cache[handlerModulePath];
  });

  it("GET reports whether AI suggestions are enabled", async () => {
    mockAi.isAiSuggestionsEnabled.mockReturnValue(true);
    const context = {};

    await suggestionsApi(context, { method: "GET", query: {} });

    expect(context.res.status).toBe(200);
    expect(context.res.body).toEqual({ enabled: true });
  });

  it("POST returns 503 when suggestions are disabled, without calling the model", async () => {
    mockAi.isAiSuggestionsEnabled.mockReturnValue(false);
    const context = {};

    await suggestionsApi(context, {
      method: "POST",
      body: { contentType: "image/jpeg", data: Buffer.from("x").toString("base64") }
    });

    expect(context.res.status).toBe(503);
    expect(mockAi.requestFoodDescriptionSuggestion).not.toHaveBeenCalled();
  });

  it("POST returns the suggestion on success", async () => {
    mockAi.isAiSuggestionsEnabled.mockReturnValue(true);
    mockAi.requestFoodDescriptionSuggestion.mockResolvedValue("Grilled octopus with paprika");
    const context = {};

    await suggestionsApi(context, {
      method: "POST",
      body: { contentType: "image/jpeg", data: Buffer.from("fake-bytes").toString("base64") }
    });

    expect(context.res.status).toBe(200);
    expect(context.res.body.suggestion).toBe("Grilled octopus with paprika");
  });

  it("maps a model failure to a 502", async () => {
    mockAi.isAiSuggestionsEnabled.mockReturnValue(true);
    mockAi.requestFoodDescriptionSuggestion.mockRejectedValue(new Error("upstream timeout"));
    const context = {};

    await suggestionsApi(context, {
      method: "POST",
      body: { contentType: "image/jpeg", data: Buffer.from("fake-bytes").toString("base64") }
    });

    expect(context.res.status).toBe(502);
    expect(context.res.body.error).toBe("upstream timeout");
  });

  it("returns 405 for an unsupported method", async () => {
    const context = {};

    await suggestionsApi(context, { method: "DELETE", query: {} });

    expect(context.res.status).toBe(405);
  });
});
