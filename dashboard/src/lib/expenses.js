import { formatCurrency } from "./format.js";

export const EXPENSE_LABELS = {
  flights: "Flights",
  hotel: "Hotel",
  food: "Food",
  entertainment: "Entertainment"
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_LABELS).map(([value, label]) => ({ value, label }));

export function createEmptyExpenseCategories() {
  return {
    flights: 0,
    hotel: 0,
    food: 0,
    entertainment: 0
  };
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function liveEntriesForYear(entries, year) {
  return (entries || []).filter((entry) => new Date(`${entry.date}T00:00:00Z`).getUTCFullYear() === Number(year));
}

export function aggregateExpenseEntries(entries) {
  const categories = createEmptyExpenseCategories();
  let total = 0;

  for (const entry of entries || []) {
    const amount = Number(entry.amount) || 0;
    total = roundMoney(total + amount);
    if (Object.prototype.hasOwnProperty.call(categories, entry.category)) {
      categories[entry.category] = roundMoney(categories[entry.category] + amount);
    }
  }

  return {
    count: Array.isArray(entries) ? entries.length : 0,
    total,
    categories
  };
}

export function combineTripYearSlice(tripSlice, liveEntriesInYear) {
  const tripLiveEntries = (liveEntriesInYear || []).filter((entry) => entry.tripSlug === tripSlice.slug);
  if (tripLiveEntries.length === 0) {
    return tripSlice;
  }

  const liveSummary = aggregateExpenseEntries(tripLiveEntries);
  const baseExpenses = tripSlice.expenses || {};
  const categories = createEmptyExpenseCategories();
  for (const category of Object.keys(categories)) {
    categories[category] = roundMoney((baseExpenses.categories?.[category] || 0) + (liveSummary.categories[category] || 0));
  }
  const partySize = baseExpenses.partySize || 2;
  const total = roundMoney((baseExpenses.total || 0) + liveSummary.total);

  return {
    ...tripSlice,
    expenses: {
      ...baseExpenses,
      categories,
      total,
      totalPerPerson: partySize > 0 ? roundMoney(total / partySize) : 0,
      isTracked: true,
      baseCurrency: baseExpenses.baseCurrency || "EUR"
    },
    liveCount: liveSummary.count
  };
}

export function calculateTripExpenseSnapshot(trip, liveEntries) {
  if (!trip) {
    return null;
  }

  const staticCategories = trip.expenses?.categories || createEmptyExpenseCategories();
  const liveSummary = aggregateExpenseEntries(liveEntries);
  const partySize = trip.expenses?.partySize || 2;
  const staticTotal = trip.expenses?.total || 0;
  const combinedCategories = createEmptyExpenseCategories();

  for (const category of Object.keys(combinedCategories)) {
    combinedCategories[category] = roundMoney((staticCategories[category] || 0) + (liveSummary.categories[category] || 0));
  }

  const combinedTotal = roundMoney(staticTotal + liveSummary.total);
  const baseCurrency = trip.expenses?.baseCurrency || (liveSummary.count > 0 ? "EUR" : null);

  return {
    baseCurrency,
    partySize,
    staticCategories,
    staticTotal,
    liveCategories: liveSummary.categories,
    liveCount: liveSummary.count,
    liveTotal: liveSummary.total,
    combinedCategories,
    combinedTotal,
    combinedPerPerson: partySize > 0 ? roundMoney(combinedTotal / partySize) : 0
  };
}

export function expenseCategoryEntries(categories, currency) {
  return Object.entries(EXPENSE_LABELS).map(([key, label]) => ({
    key,
    label,
    formattedValue: formatCurrency(categories?.[key] || 0, currency)
  }));
}
