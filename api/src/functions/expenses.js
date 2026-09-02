const { app } = require("@azure/functions");
const { randomUUID } = require("crypto");
const { getContainer } = require("../cosmosClient");

const EXPENSE_CATEGORIES = ["flights", "hotel", "food", "entertainment"];

app.http("expensesList", {
  methods: ["GET"],
  route: "expenses/{tripSlug?}",
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const container = getContainer();
      const tripSlug = request.params.tripSlug;
      const query = tripSlug
        ? {
            query: "SELECT * FROM c WHERE c.tripSlug = @tripSlug ORDER BY c.date DESC",
            parameters: [{ name: "@tripSlug", value: tripSlug }]
          }
        : { query: "SELECT * FROM c ORDER BY c.date DESC" };

      const { resources } = await container.items.query(query).fetchAll();
      return { jsonBody: resources };
    } catch (error) {
      context.error(error);
      return { status: 500, jsonBody: { error: error.message } };
    }
  }
});

app.http("expensesCreate", {
  methods: ["POST"],
  route: "expenses",
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { tripSlug, category, amount, currency, date, note } = body || {};

      if (!tripSlug || typeof tripSlug !== "string") {
        return { status: 400, jsonBody: { error: "tripSlug is required." } };
      }
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return { status: 400, jsonBody: { error: `category must be one of: ${EXPENSE_CATEGORIES.join(", ")}` } };
      }
      if (typeof amount !== "number" || !(amount > 0)) {
        return { status: 400, jsonBody: { error: "amount must be a positive number." } };
      }
      if (!currency || typeof currency !== "string") {
        return { status: 400, jsonBody: { error: "currency is required." } };
      }

      const item = {
        id: randomUUID(),
        tripSlug,
        category,
        amount,
        currency,
        date: date || new Date().toISOString().slice(0, 10),
        note: note || "",
        createdAt: new Date().toISOString()
      };

      const { resource } = await getContainer().items.create(item);
      return { status: 201, jsonBody: resource };
    } catch (error) {
      context.error(error);
      return { status: 500, jsonBody: { error: error.message } };
    }
  }
});
