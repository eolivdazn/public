// Flight health check: compares the upcoming flights written in the trip markdown files with the
// airline's published timetable and exits non-zero when one changed or disappeared.
//
//   node scripts/check-flights.mjs
//
// Run daily by .github/workflows/flight-check.yml; a failed run is how a change gets noticed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTripEntries } from "./lib/travel-data.mjs";
import { checkFlight, parseSchedule, parseTripFlights, scheduleUrl } from "./lib/flight-check.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ICONS = { ok: "✅", changed: "❌", missing: "❌", unverified: "⚠️" };
const RETRY_DELAYS_MS = [0, 5000, 15000];
const PAUSE_BETWEEN_PAGES_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The timetable site answers 503 when asked too quickly, so retry with a pause.
async function fetchSchedule(url) {
  let lastError = null;
  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay);
    try {
      const response = await fetch(url, { headers: { "User-Agent": "travel-dashboard-flight-check" } });
      if (response.ok) {
        return parseSchedule(await response.text());
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function describe(flight) {
  if (!flight.flightNumber) {
    return flight.description;
  }
  return `${flight.flightNumber} ${flight.origin} → ${flight.destination} · ${flight.departure} → ${flight.arrival}`;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const flights = loadTripEntries(rootDir)
    .flatMap(({ fileName, trip }) => parseTripFlights(fs.readFileSync(path.join(rootDir, fileName), "utf-8"), trip))
    .filter((flight) => flight.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const schedules = new Map();
  const results = [];
  for (const flight of flights) {
    if (!flight.flightNumber) {
      results.push({ flight, status: "unverified", message: "no flight number on the trip page" });
      continue;
    }
    const url = scheduleUrl(flight);
    if (!url) {
      results.push({ flight, status: "unverified", message: `no timetable source for ${flight.airline} flights` });
      continue;
    }
    if (!schedules.has(url)) {
      if (schedules.size > 0) {
        await sleep(PAUSE_BETWEEN_PAGES_MS);
      }
      schedules.set(url, await fetchSchedule(url).catch((error) => error));
    }
    const schedule = schedules.get(url);
    if (schedule instanceof Error) {
      results.push({ flight, status: "unverified", message: `timetable could not be loaded (${schedule.message})` });
      continue;
    }
    results.push({ flight, ...checkFlight(flight, schedule) });
  }

  if (results.length === 0) {
    console.log("No upcoming flights to check.");
  }
  for (const { flight, status, message } of results) {
    console.log(`${ICONS[status]} ${flight.tripSlug} · ${flight.date} · ${describe(flight)} · ${message}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const table = [
      "## ✈️ Flight check",
      "",
      "| | Trip | Date | Flight | Result |",
      "|---|---|---|---|---|",
      ...results.map(
        ({ flight, status, message }) =>
          `| ${ICONS[status]} | ${flight.tripSlug} | ${flight.date} | ${describe(flight)} | ${message} |`
      )
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table.join("\n")}\n`);
  }

  const problems = results.filter(({ status }) => status === "changed" || status === "missing");
  if (problems.length > 0) {
    console.error(`\n${problems.length} flight(s) no longer match the published timetable.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
