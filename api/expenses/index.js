const { addEntry, listEntries, updateEntry, removeEntry } = require("../lib/expense-store");
const { getClientPrincipal } = require("../lib/client-principal");

module.exports = async function expenseApi(context, req) {
  const actor = getClientPrincipal(req);

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
      const createdEntry = await addEntry(body, actor);
      const entries = await listEntries(createdEntry.tripSlug);
      const entry = entries.find((item) => item.id === createdEntry.id) || createdEntry;

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

    if (req.method === "PUT") {
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

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await updateEntry(tripSlug, id, body, actor);
      const entries = await listEntries(tripSlug);
      const entry = entries.find((item) => item.id === id);

      context.res = {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          message: "Expense updated.",
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

      await removeEntry(tripSlug, id, actor);
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
        Allow: "GET, POST, PUT, DELETE"
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


