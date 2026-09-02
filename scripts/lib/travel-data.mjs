import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const SCHEMA_VERSION = "travel-dashboard/v1";
export const EXPENSE_CATEGORIES = ["flights", "hotel", "food", "entertainment"];

function parseIsoDate(value, fieldName, fileName) {
  if (typeof value !== "string") {
    throw new Error(`${fileName}: '${fieldName}' must be a YYYY-MM-DD string.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fileName}: '${fieldName}' must be a valid YYYY-MM-DD date.`);
  }
  return value;
}

function inclusiveDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / 86400000) + 1;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function emptyExpenseCategories() {
  return Object.fromEntries(EXPENSE_CATEGORIES.map((category) => [category, 0]));
}

function emptyPartySizes() {
  return [];
}

function addExpenseCategories(left, right) {
  return Object.fromEntries(
    EXPENSE_CATEGORIES.map((category) => [category, roundCurrency((left[category] || 0) + (right[category] || 0))])
  );
}

function allocateAmountByYear(amount, daysByYear) {
  const entries = Object.entries(daysByYear)
    .map(([year, days]) => [Number(year), days])
    .sort((a, b) => a[0] - b[0]);

  if (entries.length === 0) {
    return {};
  }

  const totalDays = entries.reduce((sum, [, days]) => sum + days, 0);
  let remaining = roundCurrency(amount);

  return Object.fromEntries(
    entries.map(([year, days], index) => {
      const allocated =
        index === entries.length - 1 ? remaining : roundCurrency((amount * days) / totalDays);
      remaining = roundCurrency(remaining - allocated);
      return [year, allocated];
    })
  );
}

function allocateExpensesByYear(expenses, tripYears) {
  const categoryAllocations = Object.fromEntries(
    EXPENSE_CATEGORIES.map((category) => [category, allocateAmountByYear(expenses.categories[category], tripYears)])
  );
  const years = Object.keys(tripYears).map(Number);

  return Object.fromEntries(
    years.map((year) => {
      const categories = Object.fromEntries(
        EXPENSE_CATEGORIES.map((category) => [category, categoryAllocations[category][year] || 0])
      );
      return [
        year,
        {
          baseCurrency: expenses.baseCurrency,
          partySize: expenses.partySize,
          categories,
          total: roundCurrency(EXPENSE_CATEGORIES.reduce((sum, category) => sum + categories[category], 0)),
          totalPerPerson:
            expenses.partySize > 0
              ? roundCurrency(
                  EXPENSE_CATEGORIES.reduce((sum, category) => sum + categories[category], 0) / expenses.partySize
                )
              : 0,
          isTracked: expenses.isTracked
        }
      ];
    })
  );
}

function validateExpenses(expenses, fileName) {
  if (expenses == null) {
    return {
      baseCurrency: null,
      partySize: 2,
      categories: emptyExpenseCategories(),
      total: 0,
      totalPerPerson: 0,
      isTracked: false
    };
  }

  if (!expenses || typeof expenses !== "object") {
    throw new Error(`${fileName}: 'expenses' must be an object.`);
  }

  const baseCurrency = typeof expenses.baseCurrency === "string" ? expenses.baseCurrency.trim() : "";
  if (!baseCurrency) {
    throw new Error(`${fileName}: 'expenses.baseCurrency' is required when expenses are provided.`);
  }

  if (!expenses.categories || typeof expenses.categories !== "object") {
    throw new Error(`${fileName}: 'expenses.categories' must be an object.`);
  }

  const partySize = expenses.partySize == null ? 2 : expenses.partySize;
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new Error(`${fileName}: 'expenses.partySize' must be an integer greater than or equal to 1.`);
  }

  const categories = emptyExpenseCategories();
  for (const category of EXPENSE_CATEGORIES) {
    const value = expenses.categories[category];
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
      throw new Error(`${fileName}: 'expenses.categories.${category}' must be a number greater than or equal to 0.`);
    }
    categories[category] = roundCurrency(value);
  }

  return {
    baseCurrency,
    partySize,
    categories,
    total: roundCurrency(EXPENSE_CATEGORIES.reduce((sum, category) => sum + categories[category], 0)),
    totalPerPerson:
      partySize > 0
        ? roundCurrency(EXPENSE_CATEGORIES.reduce((sum, category) => sum + categories[category], 0) / partySize)
        : 0,
    isTracked: true
  };
}

export function splitDaysByYear(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (end < start) {
    throw new Error("endDate must be on or after startDate.");
  }

  const result = {};
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));
    const overlapStart = start > yearStart ? start : yearStart;
    const overlapEnd = end < yearEnd ? end : yearEnd;
    if (overlapStart <= overlapEnd) {
      result[year] = Math.floor((overlapEnd - overlapStart) / 86400000) + 1;
    }
  }
  return result;
}

function validatePlace(place, trip, index, fileName) {
  if (!place || typeof place !== "object") {
    throw new Error(`${fileName}: places[${index}] must be an object.`);
  }

  const city = typeof place.city === "string" ? place.city.trim() : "";
  const country = typeof place.country === "string" ? place.country.trim() : "";
  if (!city) {
    throw new Error(`${fileName}: places[${index}].city is required.`);
  }
  if (!country) {
    throw new Error(`${fileName}: places[${index}].country is required.`);
  }

  const startDate = parseIsoDate(place.startDate, `places[${index}].startDate`, fileName);
  const endDate = parseIsoDate(place.endDate, `places[${index}].endDate`, fileName);

  if (endDate < startDate) {
    throw new Error(`${fileName}: places[${index}] endDate cannot be before startDate.`);
  }
  if (startDate < trip.startDate || endDate > trip.endDate) {
    throw new Error(`${fileName}: places[${index}] dates must be inside trip startDate/endDate.`);
  }

  return {
    city,
    country,
    region: typeof place.region === "string" && place.region.trim() ? place.region.trim() : null,
    startDate,
    endDate,
    days: inclusiveDays(startDate, endDate),
    daysByYear: splitDaysByYear(startDate, endDate)
  };
}

function validateTrip(metadata, slug, fileName) {
  const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
  if (!title) {
    throw new Error(`${fileName}: 'title' is required.`);
  }
  if (metadata.schema !== SCHEMA_VERSION) {
    throw new Error(`${fileName}: 'schema' must be '${SCHEMA_VERSION}'.`);
  }
  if (metadata.tripType !== "vacation") {
    throw new Error(`${fileName}: 'tripType' must be 'vacation'.`);
  }
  if (metadata.dateCounting !== "inclusive") {
    throw new Error(`${fileName}: 'dateCounting' must be 'inclusive'.`);
  }

  const startDate = parseIsoDate(metadata.startDate, "startDate", fileName);
  const endDate = parseIsoDate(metadata.endDate, "endDate", fileName);
  if (endDate < startDate) {
    throw new Error(`${fileName}: endDate cannot be before startDate.`);
  }

  if (!Array.isArray(metadata.places) || metadata.places.length === 0) {
    throw new Error(`${fileName}: 'places' must be a non-empty array.`);
  }

  const trip = { title, slug, startDate, endDate };
  const places = metadata.places.map((place, index) => validatePlace(place, trip, index, fileName));
  const expenses = validateExpenses(metadata.expenses, fileName);

  return {
    slug,
    title,
    tripType: "vacation",
    startDate,
    endDate,
    vacationDays: inclusiveDays(startDate, endDate),
    years: splitDaysByYear(startDate, endDate),
    places,
    expenses,
    path: `${slug}.html`
  };
}

export function loadTrips(sourceDir) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name)
    .sort();

  if (markdownFiles.length === 0) {
    throw new Error("No markdown trip files were found.");
  }

  return markdownFiles.map((fileName) => {
    const slug = fileName.slice(0, -3);
    const filePath = path.join(sourceDir, fileName);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    return validateTrip(data, slug, fileName);
  });
}

export function buildDashboardData(trips) {
  const yearsMap = new Map();
  const uniqueCities = new Set();
  const uniqueCountries = new Set();

  let totalVacationDays = 0;
  let totalTrackedSpend = 0;
  let totalPerPersonSpend = 0;
  let trackedTripCount = 0;
  let detectedCurrency = null;

  for (const trip of trips) {
    totalVacationDays += trip.vacationDays;
    totalTrackedSpend = roundCurrency(totalTrackedSpend + trip.expenses.total);
    totalPerPersonSpend = roundCurrency(totalPerPersonSpend + (trip.expenses.totalPerPerson || 0));
    if (trip.expenses.isTracked) {
      trackedTripCount += 1;
      if (!detectedCurrency) {
        detectedCurrency = trip.expenses.baseCurrency;
      } else if (detectedCurrency !== trip.expenses.baseCurrency) {
        throw new Error(
          `Mixed expense currencies are not supported in totals: '${detectedCurrency}' and '${trip.expenses.baseCurrency}'.`
        );
      }
    }

    const tripCities = trip.places.map((place) => `${place.city}, ${place.country}`);
    const tripCountries = [...new Set(trip.places.map((place) => place.country))].sort();
    const expenseYears = allocateExpensesByYear(trip.expenses, trip.years);

    for (const city of tripCities) {
      uniqueCities.add(city);
    }
    for (const country of tripCountries) {
      uniqueCountries.add(country);
    }

    for (const [yearText, daysInYear] of Object.entries(trip.years)) {
      const year = Number(yearText);
      if (!yearsMap.has(year)) {
        yearsMap.set(year, {
          year,
          totalVacationDays: 0,
          totalTrackedSpend: 0,
          totalPerPersonSpend: 0,
          expenseCategories: emptyExpenseCategories(),
          partySizes: emptyPartySizes(),
          trackedTripCount: 0,
          expenseCurrency: null,
          citySet: new Set(),
          countrySet: new Set(),
          tripSlugs: new Set(),
          trips: []
        });
      }

      const bucket = yearsMap.get(year);
      bucket.totalVacationDays += daysInYear;
      bucket.tripSlugs.add(trip.slug);
      bucket.totalTrackedSpend = roundCurrency(bucket.totalTrackedSpend + (expenseYears[year]?.total || 0));
      bucket.totalPerPersonSpend = roundCurrency(
        bucket.totalPerPersonSpend + (expenseYears[year]?.totalPerPerson || 0)
      );
      bucket.expenseCategories = addExpenseCategories(bucket.expenseCategories, expenseYears[year]?.categories || emptyExpenseCategories());
      if (trip.expenses.isTracked) {
        bucket.trackedTripCount += 1;
        bucket.partySizes.push(trip.expenses.partySize);
        if (!bucket.expenseCurrency) {
          bucket.expenseCurrency = trip.expenses.baseCurrency;
        } else if (bucket.expenseCurrency !== trip.expenses.baseCurrency) {
          throw new Error(
            `Mixed expense currencies are not supported in year ${year}: '${bucket.expenseCurrency}' and '${trip.expenses.baseCurrency}'.`
          );
        }
      }
      bucket.trips.push({
        slug: trip.slug,
        title: trip.title,
        startDate: trip.startDate,
        endDate: trip.endDate,
        vacationDays: daysInYear,
        cities: tripCities,
        expenses: expenseYears[year] || trip.expenses
      });
    }

    for (const place of trip.places) {
      const placeYears = splitDaysByYear(place.startDate, place.endDate);
      for (const yearText of Object.keys(placeYears)) {
        const year = Number(yearText);
        if (!yearsMap.has(year)) {
          yearsMap.set(year, {
            year,
            totalVacationDays: 0,
            totalTrackedSpend: 0,
            totalPerPersonSpend: 0,
            expenseCategories: emptyExpenseCategories(),
            partySizes: emptyPartySizes(),
            trackedTripCount: 0,
            expenseCurrency: null,
            citySet: new Set(),
            countrySet: new Set(),
            tripSlugs: new Set(),
            trips: []
          });
        }
        const bucket = yearsMap.get(year);
        bucket.citySet.add(`${place.city}, ${place.country}`);
        bucket.countrySet.add(place.country);
      }
    }

    trip.cities = tripCities;
    trip.countries = tripCountries;
  }

  const years = [...yearsMap.values()]
    .sort((a, b) => b.year - a.year)
    .map((bucket) => ({
      year: bucket.year,
      totalVacationDays: bucket.totalVacationDays,
      totalTrackedSpend: bucket.totalTrackedSpend,
      totalPerPersonSpend: bucket.totalPerPersonSpend,
      expenseCategories: bucket.expenseCategories,
      expenseCurrency: bucket.expenseCurrency,
      partySizes: [...new Set(bucket.partySizes)].sort((a, b) => a - b),
      trackedTripCount: bucket.trackedTripCount,
      averageSpendPerTrip: bucket.trackedTripCount > 0 ? roundCurrency(bucket.totalTrackedSpend / bucket.trackedTripCount) : 0,
      averagePerPersonSpendPerTrip:
        bucket.trackedTripCount > 0 ? roundCurrency(bucket.totalPerPersonSpend / bucket.trackedTripCount) : 0,
      averageSpendPerDay: bucket.totalVacationDays > 0 ? roundCurrency(bucket.totalTrackedSpend / bucket.totalVacationDays) : 0,
      averagePerPersonSpendPerDay:
        bucket.totalVacationDays > 0 ? roundCurrency(bucket.totalPerPersonSpend / bucket.totalVacationDays) : 0,
      tripCount: bucket.tripSlugs.size,
      cityCount: bucket.citySet.size,
      countryCount: bucket.countrySet.size,
      cities: [...bucket.citySet].sort(),
      countries: [...bucket.countrySet].sort(),
      trips: bucket.trips.sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
    }));

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    summary: {
      totalVacationDays,
      totalTrips: trips.length,
      totalTrackedSpend,
      totalPerPersonSpend,
      expenseCurrency: detectedCurrency,
      trackedTripCount,
      partySizes: [...new Set(trips.filter((trip) => trip.expenses.isTracked).map((trip) => trip.expenses.partySize))].sort(
        (a, b) => a - b
      ),
      expenseCategories: trips.reduce(
        (sum, trip) => addExpenseCategories(sum, trip.expenses.categories),
        emptyExpenseCategories()
      ),
      averageSpendPerTrip: trackedTripCount > 0 ? roundCurrency(totalTrackedSpend / trackedTripCount) : 0,
      averagePerPersonSpendPerTrip:
        trackedTripCount > 0 ? roundCurrency(totalPerPersonSpend / trackedTripCount) : 0,
      averageSpendPerDay: totalVacationDays > 0 ? roundCurrency(totalTrackedSpend / totalVacationDays) : 0,
      averagePerPersonSpendPerDay:
        totalVacationDays > 0 ? roundCurrency(totalPerPersonSpend / totalVacationDays) : 0,
      uniqueCities: [...uniqueCities].sort(),
      uniqueCountries: [...uniqueCountries].sort()
    },
    years,
    trips
  };
}

export function computeTripLinks(trips) {
  return trips
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
    .map((trip) => ({
      path: `${trip.slug}.html`,
      title: trip.title,
      dates: `${trip.startDate} to ${trip.endDate}`
    }));
}

