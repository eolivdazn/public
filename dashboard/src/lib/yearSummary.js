import { createEmptyExpenseCategories, roundMoney, liveEntriesForYear, combineTripYearSlice } from "./expenses.js";

export function yearsFromData(data) {
  return Array.isArray(data?.years) ? data.years : [];
}

export function tripsFromData(data) {
  return Array.isArray(data?.trips) ? data.trips : [];
}

export function extractCountriesFromCities(cities) {
  return [...new Set((cities || []).map((city) => city.split(", ").slice(1).join(", ")).filter(Boolean))].sort();
}

export function summarizeYearTrips(trips) {
  const expenseCategories = createEmptyExpenseCategories();
  let totalTrackedSpend = 0;
  let totalPerPersonSpend = 0;
  let trackedTripCount = 0;
  let expenseCurrency = null;
  const partySizes = [];

  for (const trip of trips) {
    totalTrackedSpend = roundMoney(totalTrackedSpend + (trip.expenses?.total || 0));
    totalPerPersonSpend = roundMoney(totalPerPersonSpend + (trip.expenses?.totalPerPerson || 0));
    for (const category of Object.keys(expenseCategories)) {
      expenseCategories[category] = roundMoney(expenseCategories[category] + (trip.expenses?.categories?.[category] || 0));
    }
    if (trip.expenses?.isTracked) {
      trackedTripCount += 1;
      partySizes.push(trip.expenses.partySize || 2);
      expenseCurrency ||= trip.expenses.baseCurrency || null;
    }
  }

  return { totalTrackedSpend, totalPerPersonSpend, expenseCategories, trackedTripCount, partySizes, expenseCurrency };
}

export function filterYearItemByTrip(yearItem, tripSlug, liveEntries) {
  const yearLiveEntries = liveEntriesForYear(liveEntries, yearItem.year);

  if (tripSlug === "all") {
    const combinedTrips = (yearItem.trips || []).map((trip) => combineTripYearSlice(trip, yearLiveEntries));
    const totals = summarizeYearTrips(combinedTrips);

    return {
      ...yearItem,
      totalTrackedSpend: totals.totalTrackedSpend,
      totalPerPersonSpend: totals.totalPerPersonSpend,
      expenseCategories: totals.expenseCategories,
      expenseCurrency: yearItem.expenseCurrency || totals.expenseCurrency,
      averageSpendPerTrip: yearItem.trackedTripCount > 0 ? roundMoney(totals.totalTrackedSpend / yearItem.trackedTripCount) : 0,
      averagePerPersonSpendPerTrip:
        yearItem.trackedTripCount > 0 ? roundMoney(totals.totalPerPersonSpend / yearItem.trackedTripCount) : 0,
      averageSpendPerDay: yearItem.totalVacationDays > 0 ? roundMoney(totals.totalTrackedSpend / yearItem.totalVacationDays) : 0,
      averagePerPersonSpendPerDay:
        yearItem.totalVacationDays > 0 ? roundMoney(totals.totalPerPersonSpend / yearItem.totalVacationDays) : 0,
      trips: combinedTrips
    };
  }

  const trip = (yearItem.trips || []).find((item) => item.slug === tripSlug);
  if (!trip) {
    return null;
  }

  const combinedTrip = combineTripYearSlice(trip, yearLiveEntries);
  const cities = [...new Set(combinedTrip.cities || [])].sort();
  const countries = extractCountriesFromCities(cities);
  const trackedTripCount = combinedTrip.expenses?.isTracked ? 1 : 0;
  const totalTrackedSpend = combinedTrip.expenses?.total || 0;
  const totalPerPersonSpend = combinedTrip.expenses?.totalPerPerson || 0;
  const partySize = combinedTrip.expenses?.partySize || 2;

  return {
    ...yearItem,
    totalVacationDays: combinedTrip.vacationDays,
    totalTrackedSpend,
    totalPerPersonSpend,
    expenseCategories: combinedTrip.expenses?.categories || createEmptyExpenseCategories(),
    expenseCurrency: combinedTrip.expenses?.baseCurrency || null,
    partySizes: combinedTrip.expenses?.isTracked ? [partySize] : [],
    trackedTripCount,
    averageSpendPerTrip: trackedTripCount > 0 ? totalTrackedSpend : 0,
    averagePerPersonSpendPerTrip: trackedTripCount > 0 ? totalPerPersonSpend : 0,
    averageSpendPerDay: combinedTrip.vacationDays > 0 ? roundMoney(totalTrackedSpend / combinedTrip.vacationDays) : 0,
    averagePerPersonSpendPerDay:
      combinedTrip.vacationDays > 0 ? roundMoney(totalPerPersonSpend / combinedTrip.vacationDays) : 0,
    tripCount: 1,
    cityCount: cities.length,
    countryCount: countries.length,
    cities,
    countries,
    trips: [combinedTrip]
  };
}

export function summaryFromYears(years) {
  const cities = new Set();
  const countries = new Set();
  const trips = new Set();
  let totalVacationDays = 0;
  let totalTrackedSpend = 0;
  let totalPerPersonSpend = 0;
  let trackedTripCount = 0;
  let expenseCurrency = null;
  const partySizes = new Set();
  const expenseCategories = {
    flights: 0,
    hotel: 0,
    food: 0,
    entertainment: 0
  };

  for (const yearItem of years) {
    totalVacationDays += yearItem.totalVacationDays || 0;
    totalTrackedSpend += yearItem.totalTrackedSpend || 0;
    totalPerPersonSpend += yearItem.totalPerPersonSpend || 0;
    trackedTripCount += yearItem.trackedTripCount || 0;
    expenseCurrency ||= yearItem.expenseCurrency || null;
    for (const partySize of yearItem.partySizes || []) {
      partySizes.add(partySize);
    }
    for (const category of Object.keys(expenseCategories)) {
      expenseCategories[category] += yearItem.expenseCategories?.[category] || 0;
    }
    for (const city of yearItem.cities || []) {
      cities.add(city);
    }
    for (const country of yearItem.countries || []) {
      countries.add(country);
    }
    for (const trip of yearItem.trips || []) {
      trips.add(trip.slug);
    }
  }

  return {
    totalVacationDays,
    totalTrips: trips.size,
    totalTrackedSpend,
    totalPerPersonSpend,
    trackedTripCount,
    expenseCurrency,
    partySizes: [...partySizes].sort((a, b) => a - b),
    expenseCategories,
    averageSpendPerTrip: trackedTripCount > 0 ? Math.round((totalTrackedSpend / trackedTripCount) * 100) / 100 : 0,
    averagePerPersonSpendPerTrip:
      trackedTripCount > 0 ? Math.round((totalPerPersonSpend / trackedTripCount) * 100) / 100 : 0,
    averageSpendPerDay: totalVacationDays > 0 ? Math.round((totalTrackedSpend / totalVacationDays) * 100) / 100 : 0,
    averagePerPersonSpendPerDay:
      totalVacationDays > 0 ? Math.round((totalPerPersonSpend / totalVacationDays) * 100) / 100 : 0,
    uniqueCities: [...cities].sort(),
    uniqueCountries: [...countries].sort()
  };
}

export function partySizeLabel(partySizes) {
  if (!partySizes || partySizes.length === 0) {
    return "No shared-cost data";
  }
  if (partySizes.length === 1) {
    return `${partySizes[0]} people`;
  }
  return `Mixed: ${partySizes.join(", ")} people`;
}
