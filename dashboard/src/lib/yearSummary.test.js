import test from "node:test";
import assert from "node:assert/strict";
import {
  yearsFromData,
  tripsFromData,
  extractCountriesFromCities,
  summarizeYearTrips,
  filterYearItemByTrip,
  summaryFromYears,
  partySizeLabel
} from "./yearSummary.js";
import { createEmptyExpenseCategories } from "./expenses.js";

test("yearsFromData and tripsFromData default to empty arrays", () => {
  assert.deepEqual(yearsFromData(null), []);
  assert.deepEqual(tripsFromData({}), []);
  assert.deepEqual(yearsFromData({ years: [{ year: 2026 }] }), [{ year: 2026 }]);
});

test("extractCountriesFromCities pulls the part after the first comma and dedupes", () => {
  const cities = ["Lisbon, Portugal", "Porto, Portugal", "Bangkok, Thailand"];
  assert.deepEqual(extractCountriesFromCities(cities), ["Portugal", "Thailand"]);
});

test("summarizeYearTrips sums tracked trips only for party sizes and currency", () => {
  const trips = [
    { expenses: { total: 100, totalPerPerson: 50, categories: { food: 100, flights: 0, hotel: 0, entertainment: 0 }, isTracked: true, partySize: 2, baseCurrency: "EUR" } },
    { expenses: { total: 0, totalPerPerson: 0, categories: { food: 0, flights: 0, hotel: 0, entertainment: 0 }, isTracked: false } }
  ];
  const result = summarizeYearTrips(trips);
  assert.equal(result.totalTrackedSpend, 100);
  assert.equal(result.trackedTripCount, 1);
  assert.deepEqual(result.partySizes, [2]);
  assert.equal(result.expenseCurrency, "EUR");
});

test("filterYearItemByTrip('all') recomputes trackedTripCount and partySizes from live entries, not just the static snapshot", () => {
  const yearItem = {
    year: 2026,
    totalVacationDays: 20,
    trackedTripCount: 1,
    partySizes: [2],
    expenseCurrency: "EUR",
    trips: [
      {
        slug: "algarve2026",
        expenses: { total: 1000, totalPerPerson: 500, partySize: 2, baseCurrency: "EUR", isTracked: true, categories: { flights: 200, hotel: 800, food: 0, entertainment: 0 } }
      },
      {
        slug: "thailand2026",
        expenses: { total: 0, totalPerPerson: 0, partySize: 2, baseCurrency: null, isTracked: false, categories: createEmptyExpenseCategories() }
      }
    ]
  };
  const liveEntries = [
    { tripSlug: "thailand2026", date: "2026-02-13", category: "flights", amount: 1000 },
    { tripSlug: "thailand2026", date: "2026-02-13", category: "food", amount: 12 }
  ];

  const result = filterYearItemByTrip(yearItem, "all", liveEntries);

  assert.equal(result.trackedTripCount, 2);
  assert.deepEqual(result.partySizes, [2, 2]);
  assert.equal(result.totalTrackedSpend, 2012);
  assert.equal(result.averageSpendPerTrip, 1006);
});

test("summaryFromYears aggregates unique cities, countries and trips across years", () => {
  const years = [
    {
      totalVacationDays: 5,
      totalTrackedSpend: 100,
      totalPerPersonSpend: 50,
      trackedTripCount: 1,
      expenseCurrency: "EUR",
      partySizes: [2],
      expenseCategories: { flights: 0, hotel: 0, food: 100, entertainment: 0 },
      cities: ["Lisbon, Portugal"],
      countries: ["Portugal"],
      trips: [{ slug: "trip-a" }]
    },
    {
      totalVacationDays: 3,
      totalTrackedSpend: 0,
      totalPerPersonSpend: 0,
      trackedTripCount: 0,
      expenseCurrency: null,
      partySizes: [],
      expenseCategories: { flights: 0, hotel: 0, food: 0, entertainment: 0 },
      cities: ["Lisbon, Portugal"],
      countries: ["Portugal"],
      trips: [{ slug: "trip-b" }]
    }
  ];
  const summary = summaryFromYears(years);
  assert.equal(summary.totalVacationDays, 8);
  assert.equal(summary.totalTrips, 2);
  assert.deepEqual(summary.uniqueCities, ["Lisbon, Portugal"]);
  assert.deepEqual(summary.uniqueCountries, ["Portugal"]);
  assert.equal(summary.averageSpendPerTrip, 100);
});

test("partySizeLabel handles empty, single and mixed party sizes", () => {
  assert.equal(partySizeLabel([]), "No shared-cost data");
  assert.equal(partySizeLabel([2]), "2 people");
  assert.equal(partySizeLabel([2, 3]), "Mixed: 2, 3 people");
});
