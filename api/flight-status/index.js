// Checks one flight against the airline's published timetable, at the moment a trip page asks:
//   GET /api/flight-status?airline=EZS&number=1371&from=GVA&to=VLC&date=2026-10-16&dep=18:05&arr=19:55
// The page sends the flight as written on the trip (site/flights.json); the answer says whether
// the timetable still agrees. Public, like the trip pages (see staticwebapp.config.json).
const { checkFlight, scheduleUrl } = require("../lib/flight-check");
const { createScheduleLoader } = require("../lib/flight-schedule");

const loadSchedule = createScheduleLoader();

// Strict shapes: the values end up in the timetable URL and in the comparison.
const PARAMS = {
  airline: /^[A-Z][A-Z0-9]{1,2}$/,
  number: /^\d{1,4}$/,
  from: /^[A-Z]{3}$/,
  to: /^[A-Z]{3}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  dep: /^\d{2}:\d{2}$/,
  arr: /^\d{2}:\d{2}$/
};

function respond(context, status, body, headers = {}) {
  context.res = {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
    body
  };
}

module.exports = async function flightStatusApi(context, req) {
  if (req.method !== "GET") {
    respond(context, 405, { error: "Method not allowed." }, { Allow: "GET" });
    return;
  }

  const query = req.query || {};
  const invalid = Object.keys(PARAMS).filter(
    (name) => typeof query[name] !== "string" || !PARAMS[name].test(query[name])
  );
  if (invalid.length === 0 && Number.isNaN(Date.parse(`${query.date}T00:00:00Z`))) {
    invalid.push("date");
  }
  if (invalid.length > 0) {
    respond(context, 400, { error: `Missing or invalid parameter(s): ${invalid.join(", ")}.` });
    return;
  }

  const flight = {
    airline: query.airline,
    number: Number(query.number),
    origin: query.from,
    destination: query.to,
    date: query.date,
    departure: query.dep,
    arrival: query.arr
  };

  const url = scheduleUrl(flight);
  if (!url) {
    respond(context, 200, {
      status: "unverified",
      message: `no timetable source for ${flight.airline} flights`,
      checkedAt: new Date().toISOString()
    });
    return;
  }

  try {
    const { schedule, fetchedAt } = await loadSchedule(url);
    respond(context, 200, { ...checkFlight(flight, schedule), checkedAt: new Date(fetchedAt).toISOString() });
  } catch (error) {
    // Not an error for the page: the flight simply could not be checked right now.
    respond(context, 200, {
      status: "unverified",
      message: `timetable could not be loaded (${error.message})`,
      checkedAt: new Date().toISOString()
    });
  }
};
