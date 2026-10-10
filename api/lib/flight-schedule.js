// Loads the airline timetable pages the flight check compares against (see flight-check.js),
// keeping each one in memory for a while: the timetable site answers 503 when asked too
// quickly, and every visitor of a trip page asks for the same two routes.
const { parseSchedule } = require("./flight-check");

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns loadSchedule(url) -> { schedule, fetchedAt }. `fetchedAt` (ms) is when the page was
// really fetched, so a cached answer is not presented as checked just now. Failures are not
// cached: the next request tries again.
function createScheduleLoader({
  fetchImpl = fetch,
  now = Date.now,
  ttlMs = DEFAULT_TTL_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS
} = {}) {
  const cache = new Map();

  return async function loadSchedule(url) {
    const cached = cache.get(url);
    if (cached && now() - cached.fetchedAt < ttlMs) {
      return cached;
    }

    let lastError = null;
    for (const delay of [0, retryDelayMs]) {
      if (delay > 0) {
        await sleep(delay);
      }
      try {
        const response = await fetchImpl(url, {
          headers: { "User-Agent": "travel-dashboard-flight-check" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        if (response.ok) {
          const entry = { schedule: parseSchedule(await response.text()), fetchedAt: now() };
          cache.set(url, entry);
          return entry;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };
}

module.exports = { createScheduleLoader };
