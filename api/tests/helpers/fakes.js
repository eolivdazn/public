// In-memory stand-ins for the Cosmos containers and blob container used by the store tests.
// The container's query() only honours the partitionKey option (not the SQL text), like the
// real one does for the single-partition queries the store runs.

function createFakeContainer() {
  const items = [];
  return {
    items: {
      async create(entry) {
        items.push(entry);
        return { resource: entry };
      },
      query(querySpec, options) {
        const tripSlug = options?.partitionKey;
        const filtered = tripSlug ? items.filter((entry) => entry.tripSlug === tripSlug) : items.slice();
        return {
          async fetchAll() {
            return { resources: filtered };
          }
        };
      },
      readAll() {
        return {
          async fetchAll() {
            return { resources: items.slice() };
          }
        };
      }
    },
    item(id, partitionKey) {
      return {
        async read() {
          const found = items.find((entry) => entry.id === id && entry.tripSlug === partitionKey);
          return { resource: found };
        },
        async replace(body) {
          const index = items.findIndex((entry) => entry.id === id && entry.tripSlug === partitionKey);
          if (index === -1) {
            throw new Error("Entity not found.");
          }
          items[index] = body;
          return { resource: body };
        },
        async delete() {
          const index = items.findIndex((entry) => entry.id === id && entry.tripSlug === partitionKey);
          if (index === -1) {
            throw new Error("Entity not found.");
          }
          items.splice(index, 1);
        }
      };
    }
  };
}

function createFakeAuditContainer() {
  const records = [];
  return {
    records,
    items: {
      async create(record) {
        records.push(record);
        return { resource: record };
      },
      query(querySpec, options) {
        const tripSlug = options?.partitionKey;
        const filtered = tripSlug ? records.filter((record) => record.tripSlug === tripSlug) : records.slice();
        return {
          async fetchAll() {
            return { resources: filtered };
          }
        };
      },
      readAll() {
        return {
          async fetchAll() {
            return { resources: records.slice() };
          }
        };
      }
    }
  };
}

function createFakeBlobContainerClient() {
  const blobs = new Map();
  return {
    blobs,
    getBlockBlobClient(blobName) {
      return {
        async uploadData(buffer, options) {
          blobs.set(blobName, { buffer, contentType: options?.blobHTTPHeaders?.blobContentType });
        },
        async generateSasUrl(options) {
          if (!blobs.has(blobName)) {
            throw new Error("BlobNotFound");
          }
          return `https://fake.blob.core.windows.net/receipts/${blobName}?sas=fake&perm=${options?.permissions}`;
        }
      };
    },
    async deleteBlob(blobName) {
      if (!blobs.delete(blobName)) {
        throw new Error("BlobNotFound");
      }
    }
  };
}

module.exports = { createFakeContainer, createFakeAuditContainer, createFakeBlobContainerClient };
