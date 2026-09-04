const test = require("node:test");
const assert = require("node:assert/strict");

const { requestFoodDescriptionSuggestion } = require("../lib/ai-suggestions");

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(previous)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

function createFakeFetch(responseFactory) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return responseFactory(url, options);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("requestFoodDescriptionSuggestion throws when Azure OpenAI env vars are missing", async () => {
  await withEnv({ AZURE_OPENAI_ENDPOINT: undefined, AZURE_OPENAI_API_KEY: undefined }, async () => {
    await assert.rejects(
      () => requestFoodDescriptionSuggestion(Buffer.from("img"), "image/jpeg"),
      /not configured/
    );
  });
});

test("requestFoodDescriptionSuggestion sends the image as a base64 data URL and returns the suggestion text", async () => {
  await withEnv(
    { AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_API_KEY: "test-key", AZURE_OPENAI_DEPLOYMENT: "gpt-4o-mini" },
    async () => {
      const fetchImpl = createFakeFetch(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "  Pad Thai with shrimp  " } }] })
      }));

      const suggestion = await requestFoodDescriptionSuggestion(Buffer.from("fake-bytes"), "image/jpeg", { fetchImpl });

      assert.equal(suggestion, "Pad Thai with shrimp");
      assert.equal(fetchImpl.calls.length, 1);
      const [{ url, options }] = fetchImpl.calls;
      assert.match(url, /\/openai\/deployments\/gpt-4o-mini\/chat\/completions/);
      assert.equal(options.headers["api-key"], "test-key");
      const body = JSON.parse(options.body);
      assert.match(body.messages[0].content[1].image_url.url, /^data:image\/jpeg;base64,/);
    }
  );
});

test("requestFoodDescriptionSuggestion throws when the API responds with a non-ok status", async () => {
  await withEnv({ AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_API_KEY: "test-key" }, async () => {
    const fetchImpl = createFakeFetch(async () => ({
      ok: false,
      status: 429,
      text: async () => "rate limited"
    }));

    await assert.rejects(
      () => requestFoodDescriptionSuggestion(Buffer.from("img"), "image/jpeg", { fetchImpl }),
      /429/
    );
  });
});

test("requestFoodDescriptionSuggestion throws when the response has no suggestion text", async () => {
  await withEnv({ AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_API_KEY: "test-key" }, async () => {
    const fetchImpl = createFakeFetch(async () => ({
      ok: true,
      json: async () => ({ choices: [] })
    }));

    await assert.rejects(() => requestFoodDescriptionSuggestion(Buffer.from("img"), "image/jpeg", { fetchImpl }), /no suggestion/);
  });
});
