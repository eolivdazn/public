const { RECEIPT_CONTENT_TYPES } = require("../lib/expense-store");
const { requestFoodDescriptionSuggestion } = require("../lib/ai-suggestions");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

module.exports = async function suggestionsApi(context, req) {
  try {
    if (req.method !== "POST") {
      context.res = {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          Allow: "POST"
        },
        body: {
          error: "Method not allowed."
        }
      };
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const contentType = typeof body?.contentType === "string" ? body.contentType.split(";")[0].trim() : "";
    if (!RECEIPT_CONTENT_TYPES[contentType]) {
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { error: `Unsupported content type '${contentType}'. Allowed: ${Object.keys(RECEIPT_CONTENT_TYPES).join(", ")}.` }
      };
      return;
    }

    if (typeof body?.data !== "string" || !body.data) {
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { error: "'data' (base64-encoded image) is required." }
      };
      return;
    }

    const buffer = Buffer.from(body.data, "base64");
    if (buffer.length === 0) {
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { error: "Request body must contain image bytes." }
      };
      return;
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { error: `Image must be smaller than ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.` }
      };
      return;
    }

    const suggestion = await requestFoodDescriptionSuggestion(buffer, contentType);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { suggestion }
    };
  } catch (error) {
    console.error(error);
    context.res = {
      status: 502,
      headers: { "Content-Type": "application/json" },
      body: { error: error.message || "Could not generate a suggestion." }
    };
  }
};
