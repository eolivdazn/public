const { addEntry, listEntries, removeEntry } = require("../lib/expense-store");

module.exports = async function expenseApi(context, req) {
  try {
    if (req.method === "GET") {
      const tripSlug = typeof req.query.tripSlug === "string" && req.query.tripSlug.trim() ? req.query.tripSlug.trim() : null;
      const entries = await listEntries(tripSlug);

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

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const entry = await addEntry(body);
      const entries = await listEntries(entry.tripSlug);

      context.res = {
        status: 201,
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          message: "Expense saved.",
          entry,
          count: entries.length
        }
      };
      return;
    }

    if (req.method === "DELETE") {
      const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
      const tripSlug = typeof req.query.tripSlug === "string" ? req.query.tripSlug.trim() : "";

      if (!id || !tripSlug) {
        context.res = {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          },
          body: {
            error: "'id' and 'tripSlug' query parameters are required."
          }
        };
        return;
      }

      await removeEntry(tripSlug, id);
      const entries = await listEntries(tripSlug);

      context.res = {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          message: "Expense deleted.",
          count: entries.length
        }
      };
      return;
    }

    context.res = {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET, POST, DELETE"
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
        error: error.message || "Unable to process expense request."
      }
    };
  }
};


