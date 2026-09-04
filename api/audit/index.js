const { listAuditEntries } = require("../lib/expense-store");

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return max ? Math.min(parsed, max) : parsed;
}

module.exports = async function auditApi(context, req) {
  try {
    if (req.method === "GET") {
      const tripSlug = typeof req.query.tripSlug === "string" && req.query.tripSlug.trim() ? req.query.tripSlug.trim() : null;
      const page = parsePositiveInt(req.query.page, 1);
      const pageSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

      const result = await listAuditEntries(tripSlug, { page, pageSize });

      context.res = {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          tripSlug,
          ...result
        }
      };
      return;
    }

    context.res = {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET"
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
        error: error.message || "Unable to process audit request."
      }
    };
  }
};
