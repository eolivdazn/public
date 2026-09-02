import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const SCHEMA_VERSION = "travel-dashboard/v1";

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

  return {
    slug,
    title,
    tripType: "vacation",
    startDate,
    endDate,
    vacationDays: inclusiveDays(startDate, endDate),
    years: splitDaysByYear(startDate, endDate),
    places,
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

  for (const trip of trips) {
    totalVacationDays += trip.vacationDays;

    const tripCities = trip.places.map((place) => `${place.city}, ${place.country}`);
    const tripCountries = [...new Set(trip.places.map((place) => place.country))].sort();

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
          citySet: new Set(),
          countrySet: new Set(),
          tripSlugs: new Set(),
          trips: []
        });
      }

      const bucket = yearsMap.get(year);
      bucket.totalVacationDays += daysInYear;
      bucket.tripSlugs.add(trip.slug);
      bucket.trips.push({
        slug: trip.slug,
        title: trip.title,
        startDate: trip.startDate,
        endDate: trip.endDate,
        vacationDays: daysInYear,
        cities: tripCities
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

