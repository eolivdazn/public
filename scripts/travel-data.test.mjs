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
      path: "trip-b.html"
    }
  ];

  const data = buildDashboardData(trips);
  assert.equal(data.summary.totalVacationDays, 13);

  const year2026 = data.years.find((year) => year.year === 2026);
  const year2027 = data.years.find((year) => year.year === 2027);

  assert.equal(year2026.totalVacationDays, 10);
  assert.equal(year2026.tripCount, 2);
  assert.deepEqual(year2026.cities, ["Bangkok, Thailand", "Guia, Portugal"]);

  assert.equal(year2027.totalVacationDays, 3);
  assert.equal(year2027.tripCount, 1);
  assert.deepEqual(year2027.countries, ["Thailand"]);
});

