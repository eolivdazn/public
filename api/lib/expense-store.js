const { CosmosClient } = require("@azure/cosmos");
const crypto = require("node:crypto");

function validateIsoDate(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`'${fieldName}' must be a YYYY-MM-DD string.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`'${fieldName}' must be a valid YYYY-MM-DD date.`);
  }
  return value;
}

function generateId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `exp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeExpenseInput(payload, actor = null) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const tripSlug = typeof payload.tripSlug === "string" ? payload.tripSlug.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const amount = Number(payload.amount);
  const currency = typeof payload.currency === "string" ? payload.currency.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const date = payload.date ? validateIsoDate(payload.date, "date") : new Date().toISOString().slice(0, 10);

  if (!tripSlug) {
    throw new Error("'tripSlug' is required.");
  }
  if (!category) {
    throw new Error("'category' is required.");
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("'amount' must be a number greater than or equal to 0.");
  }

  return {
    id: generateId(),
    tripSlug,
    category,
    amount: Math.round(amount * 100) / 100,
    currency: currency || null,
    date,
    description: description || null,
    createdBy: actor ? { userId: actor.userId, userDetails: actor.userDetails } : null,
    createdAt: new Date().toISOString()
  };
}

function stripCosmosMetadata(resource) {
  const { _rid, _self, _etag, _attachments, _ts, ...entry } = resource;
  return entry;
}

function normalizeAuditRecord({ action, expenseId, tripSlug, actor }) {
  return {
    id: generateId(),
    action,
    expenseId,
    tripSlug,
    actor: actor ? { userId: actor.userId, userDetails: actor.userDetails } : null,
    at: new Date().toISOString()
  };
}

function createExpenseStore({ container, auditContainer } = {}) {
  let containerPromise = container ? Promise.resolve(container) : null;
  let auditContainerPromise = auditContainer ? Promise.resolve(auditContainer) : null;

  function getContainer() {
    if (!containerPromise) {
      containerPromise = (async () => {
        const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
        if (!connectionString) {
          throw new Error("'COSMOS_DB_CONNECTION_STRING' environment variable is required.");
        }
        const databaseName = process.env.COSMOS_DB_DATABASE_NAME || "travel-dashboard";
        const containerName = process.env.COSMOS_DB_CONTAINER_NAME || "expenses";

        const client = new CosmosClient(connectionString);
        const { database } = await client.databases.createIfNotExists({ id: databaseName });
        const { container: resolvedContainer } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ["/tripSlug"] }
        });
        return resolvedContainer;
      })();
    }
    return containerPromise;
  }

  function getAuditContainer() {
    if (!auditContainerPromise) {
      auditContainerPromise = (async () => {
        const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
        if (!connectionString) {
          throw new Error("'COSMOS_DB_CONNECTION_STRING' environment variable is required.");
        }
        const databaseName = process.env.COSMOS_DB_DATABASE_NAME || "travel-dashboard";
        const containerName = process.env.COSMOS_EXPENSE_AUDIT_CONTAINER_NAME || "expense-audit";

        const client = new CosmosClient(connectionString);
        const { database } = await client.databases.createIfNotExists({ id: databaseName });
        const { container: resolvedContainer } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ["/tripSlug"] }
        });
        return resolvedContainer;
      })();
    }
    return auditContainerPromise;
  }

  async function recordAudit(details) {
    try {
      const targetAuditContainer = await getAuditContainer();
      await targetAuditContainer.items.create(normalizeAuditRecord(details));
    } catch (error) {
      console.warn(`Failed to record expense audit entry (${details.action} ${details.expenseId}): ${error.message}`);
    }
  }

  async function listEntries(tripSlug = null) {
    const targetContainer = await getContainer();
    let resources;
    if (tripSlug) {
      const result = await targetContainer.items
        .query(
          {
            query: "SELECT * FROM c WHERE c.tripSlug = @tripSlug",
            parameters: [{ name: "@tripSlug", value: tripSlug }]
          },
          { partitionKey: tripSlug }
        )
        .fetchAll();
      resources = result.resources;
    } else {
      const result = await targetContainer.items.readAll().fetchAll();
      resources = result.resources;
    }

    return resources.map(stripCosmosMetadata).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async function addEntry(payload, actor = null) {
    const entry = normalizeExpenseInput(payload, actor);
    const targetContainer = await getContainer();
    await targetContainer.items.create(entry);
    await recordAudit({ action: "create", expenseId: entry.id, tripSlug: entry.tripSlug, actor });
    return entry;
  }

  async function removeEntry(tripSlug, id, actor = null) {
    const targetContainer = await getContainer();
    await targetContainer.item(id, tripSlug).delete();
    await recordAudit({ action: "delete", expenseId: id, tripSlug, actor });
  }

  return { listEntries, addEntry, removeEntry };
}

let defaultStore = null;
function getDefaultStore() {
  if (!defaultStore) {
    defaultStore = createExpenseStore();
  }
  return defaultStore;
}

module.exports = {
  createExpenseStore,
  normalizeExpenseInput,
  listEntries: (tripSlug) => getDefaultStore().listEntries(tripSlug),
  addEntry: (payload, actor) => getDefaultStore().addEntry(payload, actor),
  removeEntry: (tripSlug, id, actor) => getDefaultStore().removeEntry(tripSlug, id, actor)
};
