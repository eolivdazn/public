import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardData, splitDaysByYear } from "./lib/travel-data.mjs";

test("splitDaysByYear handles same-year ranges", () => {
  const result = splitDaysByYear("2026-09-13", "2026-09-19");
  assert.deepEqual(result, { 2026: 7 });
});

test("splitDaysByYear splits cross-year ranges", () => {
  const result = splitDaysByYear("2026-12-29", "2027-01-03");
  assert.deepEqual(result, { 2026: 3, 2027: 3 });
});

test("buildDashboardData aggregates trips by year and cities", () => {
  const trips = [
    {
      slug: "trip-a",
      title: "Trip A",
      tripType: "vacation",
      startDate: "2026-12-29",
      endDate: "2027-01-03",
      vacationDays: 6,
      years: { 2026: 3, 2027: 3 },
      places: [
        {
          city: "Bangkok",
          country: "Thailand",
          region: null,
          startDate: "2026-12-29",
          endDate: "2027-01-03",
          days: 6,
          daysByYear: { 2026: 3, 2027: 3 }
        }
      ],
      expenses: {
        baseCurrency: "EUR",
        partySize: 2,
        categories: {
          flights: 100,
          hotel: 800,
          food: 0,
          entertainment: 0
        },
        total: 900,
        totalPerPerson: 450,
        isTracked: true
      },
      path: "trip-a.html"
    },
    {
      slug: "trip-b",
      title: "Trip B",
      tripType: "vacation",
      startDate: "2026-09-13",
      endDate: "2026-09-19",
      vacationDays: 7,
      years: { 2026: 7 },
      places: [
        {
          city: "Guia",
          country: "Portugal",
          region: "Algarve",
          startDate: "2026-09-13",
          endDate: "2026-09-19",
          days: 7,
          daysByYear: { 2026: 7 }
        }
      ],
      expenses: {
        baseCurrency: "EUR",
        partySize: 2,
        categories: {
          flights: 150,
          hotel: 100,
          food: 0,
          entertainment: 0
        },
        total: 250,
        totalPerPerson: 125,
        isTracked: true
      },
      path: "trip-b.html"
    }
  ];

  const data = buildDashboardData(trips);
  assert.equal(data.summary.totalVacationDays, 13);
  assert.equal(data.summary.totalTrackedSpend, 1150);
  assert.equal(data.summary.totalPerPersonSpend, 575);
  assert.equal(data.summary.expenseCurrency, "EUR");
  assert.deepEqual(data.summary.partySizes, [2]);
  assert.deepEqual(data.summary.expenseCategories, {
    flights: 250,
    hotel: 900,
    food: 0,
    entertainment: 0
  });

  const year2026 = data.years.find((year) => year.year === 2026);
  const year2027 = data.years.find((year) => year.year === 2027);

  assert.equal(year2026.totalVacationDays, 10);
  assert.equal(year2026.tripCount, 2);
  assert.equal(year2026.totalTrackedSpend, 700);
  assert.equal(year2026.totalPerPersonSpend, 350);
  assert.deepEqual(year2026.partySizes, [2]);
  assert.deepEqual(year2026.expenseCategories, {
    flights: 200,
    hotel: 500,
    food: 0,
    entertainment: 0
  });
  assert.deepEqual(year2026.cities, ["Bangkok, Thailand", "Guia, Portugal"]);

  assert.equal(year2027.totalVacationDays, 3);
  assert.equal(year2027.tripCount, 1);
  assert.equal(year2027.totalTrackedSpend, 450);
  assert.equal(year2027.totalPerPersonSpend, 225);
  assert.deepEqual(year2027.partySizes, [2]);
  assert.deepEqual(year2027.expenseCategories, {
    flights: 50,
    hotel: 400,
    food: 0,
    entertainment: 0
  });
  assert.deepEqual(year2027.countries, ["Thailand"]);
});

