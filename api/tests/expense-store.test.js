const test = require("node:test");
const assert = require("node:assert/strict");

const store = require("../lib/expense-store");

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
      }
    }
  };
}

test("normalizeExpenseInput validates and fills defaults", () => {
  const entry = store.normalizeExpenseInput({
    tripSlug: "algarve2026",
    category: "food",
    amount: "42.50",
    currency: "EUR",
    description: "Dinner"
  });

  assert.equal(entry.tripSlug, "algarve2026");
  assert.equal(entry.category, "food");
  assert.equal(entry.amount, 42.5);
  assert.equal(entry.currency, "EUR");
  assert.equal(entry.description, "Dinner");
  assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(entry.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(entry.createdBy, null);
});

test("normalizeExpenseInput records the actor as createdBy when provided", () => {
  const entry = store.normalizeExpenseInput(
    { tripSlug: "algarve2026", category: "food", amount: 10 },
    { userId: "u1", userDetails: "eduardo.oliveira", identityProvider: "github", userRoles: ["approved"] }
  );

  assert.deepEqual(entry.createdBy, { userId: "u1", userDetails: "eduardo.oliveira" });
});

test("store persists and filters expenses by tripSlug", async () => {
  const fakeContainer = createFakeContainer();
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: fakeContainer, auditContainer: fakeAuditContainer });
  const actor = { userId: "u1", userDetails: "eduardo.oliveira" };

  const first = await expenseStore.addEntry(
    {
      tripSlug: "algarve2026",
      category: "food",
      amount: 12.34,
      currency: "EUR",
      date: "2026-09-14",
      description: "Lunch"
    },
    actor
  );
  const second = await expenseStore.addEntry({
    tripSlug: "el-gouna2027",
    category: "food",
    amount: 22,
    currency: "EUR",
    date: "2027-01-24",
    description: "Dinner"
  });

  assert.ok(first.id);
  assert.ok(second.id);
  assert.deepEqual(first.createdBy, actor);

  const all = await expenseStore.listEntries();
  assert.equal(all.length, 2);

  const filtered = await expenseStore.listEntries("algarve2026");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].tripSlug, "algarve2026");
  assert.equal(filtered[0].amount, 12.34);

  await expenseStore.removeEntry("algarve2026", first.id, actor);
  const afterRemoval = await expenseStore.listEntries();
  assert.equal(afterRemoval.length, 1);
  assert.equal(afterRemoval[0].id, second.id);

  assert.equal(fakeAuditContainer.records.length, 3);
  assert.deepEqual(
    fakeAuditContainer.records.map((record) => record.action),
    ["create", "create", "delete"]
  );
  const deleteRecord = fakeAuditContainer.records.find((record) => record.action === "delete");
  assert.equal(deleteRecord.expenseId, first.id);
  assert.equal(deleteRecord.tripSlug, "algarve2026");
  assert.deepEqual(deleteRecord.actor, actor);
});
