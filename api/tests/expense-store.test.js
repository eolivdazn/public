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

test("normalizeExpenseInput rejects a zero or missing amount", () => {
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: 0 }), /greater than 0/);
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: "" }), /greater than 0/);
  assert.throws(() => store.normalizeExpenseInput({ tripSlug: "algarve2026", category: "food", amount: -5 }), /greater than 0/);
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

test("listAuditEntries returns an empty page when nothing has been recorded", async () => {
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: createFakeAuditContainer() });
  const result = await expenseStore.listAuditEntries();

  assert.deepEqual(result.entries, []);
  assert.equal(result.total, 0);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 10);
  assert.equal(result.totalPages, 1);
});

test("listAuditEntries sorts by most recent first and strips Cosmos metadata", async () => {
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: fakeAuditContainer });

  fakeAuditContainer.records.push(
    { id: "a1", action: "create", expenseId: "e1", tripSlug: "algarve2026", actor: null, at: "2026-09-01T10:00:00.000Z", _rid: "r1", _etag: "t1" },
    { id: "a2", action: "create", expenseId: "e2", tripSlug: "el-gouna2027", actor: null, at: "2026-09-02T10:00:00.000Z" },
    {
      id: "a3",
      action: "delete",
      expenseId: "e1",
      tripSlug: "algarve2026",
      actor: { userId: "u1", userDetails: "eduardo.oliveira" },
      at: "2026-09-03T10:00:00.000Z"
    }
  );

  const result = await expenseStore.listAuditEntries();

  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["a3", "a2", "a1"]
  );
  assert.equal(result.entries[2]._rid, undefined);
  assert.deepEqual(result.entries[0].actor, { userId: "u1", userDetails: "eduardo.oliveira" });
  assert.equal(result.total, 3);
  assert.equal(result.totalPages, 1);
});

test("listAuditEntries filters by tripSlug", async () => {
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: fakeAuditContainer });

  fakeAuditContainer.records.push(
    { id: "a1", action: "create", expenseId: "e1", tripSlug: "algarve2026", actor: null, at: "2026-09-01T10:00:00.000Z" },
    { id: "a2", action: "create", expenseId: "e2", tripSlug: "el-gouna2027", actor: null, at: "2026-09-02T10:00:00.000Z" }
  );

  const result = await expenseStore.listAuditEntries("algarve2026");

  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["a1"]
  );
  assert.equal(result.total, 1);
});

test("listAuditEntries paginates results using page and pageSize", async () => {
  const fakeAuditContainer = createFakeAuditContainer();
  const expenseStore = store.createExpenseStore({ container: createFakeContainer(), auditContainer: fakeAuditContainer });

  for (let i = 1; i <= 5; i += 1) {
    fakeAuditContainer.records.push({
      id: `a${i}`,
      action: "create",
      expenseId: `e${i}`,
      tripSlug: "algarve2026",
      actor: null,
      at: `2026-09-0${i}T10:00:00.000Z`
    });
  }

  const firstPage = await expenseStore.listAuditEntries(null, { page: 1, pageSize: 2 });
  assert.deepEqual(
    firstPage.entries.map((entry) => entry.id),
    ["a5", "a4"]
  );
  assert.equal(firstPage.total, 5);
  assert.equal(firstPage.totalPages, 3);

  const secondPage = await expenseStore.listAuditEntries(null, { page: 2, pageSize: 2 });
  assert.deepEqual(
    secondPage.entries.map((entry) => entry.id),
    ["a3", "a2"]
  );

  const lastPage = await expenseStore.listAuditEntries(null, { page: 3, pageSize: 2 });
  assert.deepEqual(
    lastPage.entries.map((entry) => entry.id),
    ["a1"]
  );

  const pastLastPage = await expenseStore.listAuditEntries(null, { page: 4, pageSize: 2 });
  assert.deepEqual(pastLastPage.entries, []);
  assert.equal(pastLastPage.total, 5);
  assert.equal(pastLastPage.totalPages, 3);
});
