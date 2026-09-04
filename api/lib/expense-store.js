const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient, BlobSASPermissions } = require("@azure/storage-blob");
const crypto = require("node:crypto");

const RECEIPT_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

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

function buildExpenseFields(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const tripSlug = typeof payload.tripSlug === "string" ? payload.tripSlug.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const amount = Number(payload.amount);
  const currency = typeof payload.currency === "string" ? payload.currency.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const date = payload.date ? validateIsoDate(payload.date, "date") : new Date().toISOString().slice(0, 10);
  const receiptBlobName = typeof payload.receiptBlobName === "string" && payload.receiptBlobName.trim() ? payload.receiptBlobName.trim() : null;
  const rating = payload.rating === undefined || payload.rating === null || payload.rating === "" ? null : Number(payload.rating);
  const photoLocation =
    payload.photoLocation && typeof payload.photoLocation === "object"
      ? { latitude: Number(payload.photoLocation.latitude), longitude: Number(payload.photoLocation.longitude) }
      : null;

  if (!tripSlug) {
    throw new Error("'tripSlug' is required.");
  }
  if (!category) {
    throw new Error("'category' is required.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("'amount' must be a number greater than 0.");
  }
  if (rating !== null && (!Number.isFinite(rating) || rating <= 0 || rating > 5 || Math.round(rating * 2) !== rating * 2)) {
    throw new Error("'rating' must be a multiple of 0.5 between 0.5 and 5.");
  }
  if (photoLocation && (!Number.isFinite(photoLocation.latitude) || photoLocation.latitude < -90 || photoLocation.latitude > 90)) {
    throw new Error("'photoLocation.latitude' must be a number between -90 and 90.");
  }
  if (photoLocation && (!Number.isFinite(photoLocation.longitude) || photoLocation.longitude < -180 || photoLocation.longitude > 180)) {
    throw new Error("'photoLocation.longitude' must be a number between -180 and 180.");
  }

  return {
    tripSlug,
    category,
    amount: Math.round(amount * 100) / 100,
    currency: currency || null,
    date,
    description: description || null,
    receiptBlobName,
    rating,
    photoLocation
  };
}

function normalizeExpenseInput(payload, actor = null) {
  return {
    id: generateId(),
    ...buildExpenseFields(payload),
    createdBy: actor ? { userId: actor.userId, userDetails: actor.userDetails } : null,
    createdAt: new Date().toISOString()
  };
}

function normalizeExpenseUpdate(payload) {
  return buildExpenseFields(payload);
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

function createExpenseStore({ container, auditContainer, blobContainerClient } = {}) {
  let containerPromise = container ? Promise.resolve(container) : null;
  let auditContainerPromise = auditContainer ? Promise.resolve(auditContainer) : null;
  let blobContainerClientPromise = blobContainerClient ? Promise.resolve(blobContainerClient) : null;

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

  function getBlobContainerClient() {
    if (!blobContainerClientPromise) {
      blobContainerClientPromise = (async () => {
        const connectionString = process.env.BLOB_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
          throw new Error("'BLOB_STORAGE_CONNECTION_STRING' environment variable is required.");
        }
        const containerName = process.env.RECEIPTS_CONTAINER_NAME || "receipts";

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const resolvedContainerClient = blobServiceClient.getContainerClient(containerName);
        await resolvedContainerClient.createIfNotExists();
        return resolvedContainerClient;
      })();
    }
    return blobContainerClientPromise;
  }

  async function generateReceiptSasUrl(blobName) {
    try {
      const targetBlobContainer = await getBlobContainerClient();
      const blockBlobClient = targetBlobContainer.getBlockBlobClient(blobName);
      const expiresOn = new Date(Date.now() + 60 * 60 * 1000);
      return await blockBlobClient.generateSasUrl({ permissions: BlobSASPermissions.parse("r"), expiresOn });
    } catch (error) {
      console.warn(`Failed to generate receipt URL (${blobName}): ${error.message}`);
      return null;
    }
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

    const entries = resources.map(stripCosmosMetadata).sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    const entriesWithReceipt = entries.filter((entry) => entry.receiptBlobName);
    if (entriesWithReceipt.length > 0) {
      await Promise.all(
        entriesWithReceipt.map(async (entry) => {
          entry.receiptUrl = await generateReceiptSasUrl(entry.receiptBlobName);
        })
      );
    }

    return entries;
  }

  async function addEntry(payload, actor = null) {
    const entry = normalizeExpenseInput(payload, actor);
    const targetContainer = await getContainer();
    await targetContainer.items.create(entry);
    await recordAudit({ action: "create", expenseId: entry.id, tripSlug: entry.tripSlug, actor });
    return entry;
  }

  async function updateEntry(tripSlug, id, payload, actor = null) {
    const fields = normalizeExpenseUpdate(payload);
    const targetContainer = await getContainer();
    const { resource: existing } = await targetContainer.item(id, tripSlug).read();
    if (!existing) {
      throw new Error("Expense not found.");
    }

    const previousReceiptBlobName = existing.receiptBlobName || null;
    const updated = {
      ...existing,
      ...fields,
      id,
      tripSlug
    };

    const { resource } = await targetContainer.item(id, tripSlug).replace(updated);
    await recordAudit({ action: "update", expenseId: id, tripSlug, actor });

    if (previousReceiptBlobName && previousReceiptBlobName !== fields.receiptBlobName) {
      try {
        const targetBlobContainer = await getBlobContainerClient();
        await targetBlobContainer.deleteBlob(previousReceiptBlobName);
      } catch (error) {
        console.warn(`Failed to delete replaced receipt blob (${previousReceiptBlobName}): ${error.message}`);
      }
    }

    return stripCosmosMetadata(resource);
  }

  async function removeEntry(tripSlug, id, actor = null, receiptBlobName = null) {
    const targetContainer = await getContainer();
    await targetContainer.item(id, tripSlug).delete();
    await recordAudit({ action: "delete", expenseId: id, tripSlug, actor });

    if (receiptBlobName) {
      try {
        const targetBlobContainer = await getBlobContainerClient();
        await targetBlobContainer.deleteBlob(receiptBlobName);
      } catch (error) {
        console.warn(`Failed to delete receipt blob (${receiptBlobName}): ${error.message}`);
      }
    }
  }

  async function uploadReceipt(tripSlug, buffer, contentType) {
    if (!tripSlug) {
      throw new Error("'tripSlug' is required.");
    }
    const extension = RECEIPT_CONTENT_TYPES[contentType];
    if (!extension) {
      throw new Error(`Unsupported receipt content type '${contentType}'.`);
    }

    const blobName = `${tripSlug}/${generateId()}.${extension}`;
    const targetBlobContainer = await getBlobContainerClient();
    const blockBlobClient = targetBlobContainer.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });

    return { blobName };
  }

  async function listAuditEntries(tripSlug = null, { page = 1, pageSize = 10 } = {}) {
    const targetContainer = await getAuditContainer();
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

    const sorted = resources.map(stripCosmosMetadata).sort((left, right) => right.at.localeCompare(left.at));
    const total = sorted.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const start = (page - 1) * pageSize;

    return {
      entries: sorted.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages
    };
  }

  return { listEntries, listAuditEntries, addEntry, updateEntry, removeEntry, uploadReceipt };
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
  normalizeExpenseUpdate,
  RECEIPT_CONTENT_TYPES,
  listEntries: (tripSlug) => getDefaultStore().listEntries(tripSlug),
  listAuditEntries: (tripSlug, pagination) => getDefaultStore().listAuditEntries(tripSlug, pagination),
  addEntry: (payload, actor) => getDefaultStore().addEntry(payload, actor),
  updateEntry: (tripSlug, id, payload, actor) => getDefaultStore().updateEntry(tripSlug, id, payload, actor),
  removeEntry: (tripSlug, id, actor, receiptBlobName) => getDefaultStore().removeEntry(tripSlug, id, actor, receiptBlobName),
  uploadReceipt: (tripSlug, buffer, contentType) => getDefaultStore().uploadReceipt(tripSlug, buffer, contentType)
};
