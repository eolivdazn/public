const DEFAULT_DEPLOYMENT = "gpt-4.1-mini";
const DEFAULT_API_VERSION = "2024-08-01-preview";

function isAiSuggestionsEnabled() {
  return process.env.AI_SUGGESTIONS_ENABLED !== "false";
}

async function requestFoodDescriptionSuggestion(buffer, contentType, { fetchImpl = fetch } = {}) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || DEFAULT_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION;

  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI is not configured ('AZURE_OPENAI_ENDPOINT'/'AZURE_OPENAI_API_KEY' missing).");
  }

  const base64 = buffer.toString("base64");
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Briefly name the dish or food shown in this photo, max 6 words, no trailing punctuation, just the name " +
                "(e.g. 'Grilled salmon with vegetables'). If it's not clearly food, reply with 'Meal'."
            },
            { type: "image_url", image_url: { url: `data:${contentType};base64,${base64}` } }
          ]
        }
      ],
      max_tokens: 20,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Azure OpenAI request failed (${response.status}): ${errorBody.slice(0, 200)}`);
  }

  const payload = await response.json();
  const suggestion = payload?.choices?.[0]?.message?.content?.trim();
  if (!suggestion) {
    throw new Error("Azure OpenAI returned no suggestion.");
  }

  return suggestion;
}

module.exports = { requestFoodDescriptionSuggestion, isAiSuggestionsEnabled };
