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
});

test("store persists and filters expenses by tripSlug", async () => {
  const fakeContainer = createFakeContainer();
  const expenseStore = store.createExpenseStore({ container: fakeContainer });

  const first = await expenseStore.addEntry({
    tripSlug: "algarve2026",
    category: "food",
    amount: 12.34,
    currency: "EUR",
    date: "2026-09-14",
    description: "Lunch"
  });
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

  const all = await expenseStore.listEntries();
  assert.equal(all.length, 2);

  const filtered = await expenseStore.listEntries("algarve2026");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].tripSlug, "algarve2026");
  assert.equal(filtered[0].amount, 12.34);
});
