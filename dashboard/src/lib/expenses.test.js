import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyExpenseCategories,
  roundMoney,
  liveEntriesForYear,
  aggregateExpenseEntries,
  combineTripYearSlice,
  calculateTripExpenseSnapshot,
  expenseCategoryEntries
} from "./expenses.js";

test("createEmptyExpenseCategories returns all categories at zero", () => {
  assert.deepEqual(createEmptyExpenseCategories(), { flights: 0, hotel: 0, food: 0, entertainment: 0 });
});

test("roundMoney rounds to two decimals", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(19.9949), 19.99);
});

test("liveEntriesForYear filters entries by UTC year of the date field", () => {
  const entries = [
    { date: "2026-01-05" },
    { date: "2027-06-01" },
    { date: "2026-12-31" }
  ];
  assert.deepEqual(liveEntriesForYear(entries, 2026), [{ date: "2026-01-05" }, { date: "2026-12-31" }]);
});

test("aggregateExpenseEntries sums totals per category and ignores unknown categories", () => {
  const entries = [
    { category: "food", amount: 10 },
    { category: "food", amount: 5.5 },
    { category: "unknown", amount: 100 }
  ];
  const result = aggregateExpenseEntries(entries);
  assert.equal(result.count, 3);
  assert.equal(result.total, 115.5);
  assert.equal(result.categories.food, 15.5);
  assert.equal(result.categories.hotel, 0);
});

test("combineTripYearSlice returns the original slice when no live entries match", () => {
  const tripSlice = { slug: "trip-a", expenses: { total: 50, partySize: 2 } };
  assert.equal(combineTripYearSlice(tripSlice, []), tripSlice);
});

test("combineTripYearSlice merges matching live entries into the trip's expenses", () => {
  const tripSlice = {
    slug: "trip-a",
    expenses: { total: 50, partySize: 2, baseCurrency: "EUR", categories: { food: 10, flights: 0, hotel: 0, entertainment: 0 } }
  };
  const liveEntries = [
    { tripSlug: "trip-a", category: "food", amount: 20 },
    { tripSlug: "trip-b", category: "food", amount: 999 }
  ];
  const result = combineTripYearSlice(tripSlice, liveEntries);
  assert.equal(result.expenses.total, 70);
  assert.equal(result.expenses.categories.food, 30);
  assert.equal(result.expenses.totalPerPerson, 35);
  assert.equal(result.liveCount, 1);
  assert.equal(result.expenses.isTracked, true);
  assert.equal(result.expenses.baseCurrency, "EUR");
});

test("combineTripYearSlice marks an untracked trip as tracked once it has live entries, defaulting currency to EUR", () => {
  const tripSlice = {
    slug: "thailand2026",
    expenses: { total: 0, totalPerPerson: 0, partySize: 2, baseCurrency: null, isTracked: false, categories: createEmptyExpenseCategories() }
  };
  const liveEntries = [
    { tripSlug: "thailand2026", category: "flights", amount: 1000 },
    { tripSlug: "thailand2026", category: "food", amount: 12 }
  ];
  const result = combineTripYearSlice(tripSlice, liveEntries);
  assert.equal(result.expenses.isTracked, true);
  assert.equal(result.expenses.baseCurrency, "EUR");
  assert.equal(result.expenses.total, 1012);
  assert.equal(result.expenses.totalPerPerson, 506);
});

test("calculateTripExpenseSnapshot returns null for a missing trip", () => {
  assert.equal(calculateTripExpenseSnapshot(null, []), null);
});

test("calculateTripExpenseSnapshot combines static and live totals", () => {
  const trip = { expenses: { baseCurrency: "EUR", partySize: 2, total: 100, categories: { food: 40, flights: 60, hotel: 0, entertainment: 0 } } };
  const liveEntries = [{ category: "food", amount: 10 }];
  const snapshot = calculateTripExpenseSnapshot(trip, liveEntries);
  assert.equal(snapshot.combinedTotal, 110);
  assert.equal(snapshot.combinedCategories.food, 50);
  assert.equal(snapshot.combinedPerPerson, 55);
});

test("calculateTripExpenseSnapshot defaults baseCurrency to EUR when the trip has no static currency but has live entries", () => {
  const trip = { expenses: { baseCurrency: null, partySize: 2, total: 0, categories: createEmptyExpenseCategories() } };
  const liveEntries = [{ category: "food", amount: 12 }];
  const snapshot = calculateTripExpenseSnapshot(trip, liveEntries);
  assert.equal(snapshot.baseCurrency, "EUR");
  assert.equal(snapshot.combinedTotal, 12);
});

test("calculateTripExpenseSnapshot keeps baseCurrency null when the trip has neither static nor live data", () => {
  const trip = { expenses: { baseCurrency: null, partySize: 2, total: 0, categories: createEmptyExpenseCategories() } };
  const snapshot = calculateTripExpenseSnapshot(trip, []);
  assert.equal(snapshot.baseCurrency, null);
});

test("expenseCategoryEntries maps each category to a label and formatted value", () => {
  const entries = expenseCategoryEntries({ flights: 100, hotel: 0, food: 25.5, entertainment: 0 }, "EUR");
  assert.deepEqual(entries.map((entry) => entry.key), ["flights", "hotel", "food", "entertainment"]);
  const flights = entries.find((entry) => entry.key === "flights");
  assert.equal(flights.label, "Flights");
  assert.equal(flights.formattedValue, "€100");
});
