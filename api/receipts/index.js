const { uploadReceipt, RECEIPT_CONTENT_TYPES } = require("../lib/expense-store");

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

module.exports = async function receiptsApi(context, req) {
  try {
    if (req.method === "POST") {
      const tripSlug = typeof req.query.tripSlug === "string" && req.query.tripSlug.trim() ? req.query.tripSlug.trim() : "";
      if (!tripSlug) {
        context.res = {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: { error: "'tripSlug' query parameter is required." }
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
      if (buffer.length > MAX_RECEIPT_BYTES) {
        context.res = {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: { error: `Receipt image must be smaller than ${MAX_RECEIPT_BYTES / (1024 * 1024)}MB.` }
        };
        return;
      }

      const result = await uploadReceipt(tripSlug, buffer, contentType);

      context.res = {
        status: 201,
        headers: { "Content-Type": "application/json" },
        body: {
          message: "Receipt uploaded.",
          blobName: result.blobName
        }
      };
      return;
    }

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
  } catch (error) {
    console.error(error);
    context.res = {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        error: error.message || "Unable to process receipt upload."
      }
    };
  }
};
