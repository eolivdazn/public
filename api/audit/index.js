const { listAuditEntries } = require("../lib/expense-store");

module.exports = async function auditApi(context, req) {
  try {
    if (req.method === "GET") {
      const tripSlug = typeof req.query.tripSlug === "string" && req.query.tripSlug.trim() ? req.query.tripSlug.trim() : null;
      const entries = await listAuditEntries(tripSlug);

      context.res = {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          tripSlug,
          count: entries.length,
          entries
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
