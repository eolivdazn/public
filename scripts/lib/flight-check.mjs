// Flight health check: reads the flights written in the trip markdown files and compares them
// with the airline's published timetable, so a schedule change shows up before the trip.
//
// A flight is read from an itinerary item like
//   - **Fri 13 Nov** ✈️ Flight
//     GVA → KRK — EZS1353 (17:45 → 19:45)
// The year comes from the trip's startDate/endDate. Items with ✈️ but no flight number
// ("Voo de ida · 18:05") are still returned, so the report can say they could not be checked.

// English abbreviations and Portuguese month names, keyed by their first three letters.
const MONTHS = {
  jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Flight-number prefixes (ICAO or IATA) -> the airline's route page name on flightmapper.net.
const SCHEDULE_AIRLINES = {
  EZS: "EasyJet_U2",
  EZY: "EasyJet_U2",
  EJU: "EasyJet_U2",
  U2: "EasyJet_U2"
};

const ITEM_START = /^\s*-\s+\*\*([^*]+)\*\*\s*(.*)$/;
const FLIGHT_DETAILS =
  /\b([A-Z]{3})\b(?:\s*\([^)]*\))?\s*→\s*([A-Z]{3})\b(?:\s*\([^)]*\))?\s*[—–-]\s*([A-Z][A-Z0-9]{1,2})\s?(\d{1,4})\s*\((\d{2}:\d{2})\s*→\s*(\d{2}:\d{2})/;

function pad(value) {
  return String(value).padStart(2, "0");
}

// "Fri 13 Nov" / "16 outubro" -> ISO date inside the trip's date range, or null.
function resolveDate(label, trip) {
  const match = label.match(/(\d{1,2})\s+([A-Za-z]+)/);
  const month = match ? MONTHS[match[2].toLowerCase().slice(0, 3)] : undefined;
  if (!month) {
    return null;
  }
  const startYear = Number(trip.startDate.slice(0, 4));
  const endYear = Number(trip.endDate.slice(0, 4));
  for (let year = startYear; year <= endYear; year += 1) {
    const date = `${year}-${pad(month)}-${pad(match[1])}`;
    if (date >= trip.startDate && date <= trip.endDate) {
      return date;
    }
  }
  return `${startYear}-${pad(month)}-${pad(match[1])}`;
}

export function parseTripFlights(markdown, trip) {
  const lines = markdown.split(/\r?\n/);
  const flights = [];

  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index].match(ITEM_START);
    if (!start || !start[2].includes("✈")) {
      continue;
    }
    const date = resolveDate(start[1], trip);
    if (!date) {
      continue;
    }

    // The item's text: its first line plus the indented lines that follow.
    const parts = [start[2]];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (!lines[next].trim() || /^\s*-\s/.test(lines[next]) || /^#/.test(lines[next])) {
        break;
      }
      parts.push(lines[next].trim());
    }
    const text = parts.join(" ");

    const details = text.match(FLIGHT_DETAILS);
    const base = { tripSlug: trip.slug, date };
    if (!details) {
      flights.push({ ...base, flightNumber: null, description: text.replace(/\s+/g, " ").trim() });
      continue;
    }
    flights.push({
      ...base,
      origin: details[1],
      destination: details[2],
      airline: details[3],
      number: Number(details[4]),
      flightNumber: `${details[3]}${details[4]}`,
      departure: details[5],
      arrival: details[6]
    });
  }

  return flights;
}

// The timetable page for a flight's airline and route, or null when the airline is not supported.
export function scheduleUrl(flight) {
  const airline = SCHEDULE_AIRLINES[flight.airline];
  if (!airline) {
    return null;
  }
  return `https://info.flightmapper.net/route/${airline}_${flight.origin}_${flight.destination}`;
}

// Parses a flightmapper route page. Each timetable row is one table cell:
//   Fri 17:45 Geneva (GVA) 1 19:45 Krakow (KRK) EasyJet U2 1353 Non-stop ... Effective from 2026-10-30
// `horizon` is the last date the site's calendar offers, i.e. how far the timetable is published.
export function parseSchedule(html) {
  const horizonMatch = html.match(/rangeHigh:"(\d{4})(\d{2})(\d{2})"/);
  const horizon = horizonMatch ? `${horizonMatch[1]}-${horizonMatch[2]}-${horizonMatch[3]}` : null;

  const rows = [];
  for (const [, cell] of html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)) {
    const airports = [...cell.matchAll(/\/airport\/([A-Z]{3})"/g)].map((match) => match[1]);
    const flight = cell.match(/\/flight\/[A-Za-z]+_[A-Z0-9]{2}_(\d+)"/);
    const text = cell.replace(/<[^>]+>/g, " ");
    const weekdays = text.match(/^\s*([A-Za-z]{3}(?:,[A-Za-z]{3})*)\s/);
    const times = text.match(/\d{2}:\d{2}/g) || [];
    if (airports.length < 2 || !flight || !weekdays || times.length < 2) {
      continue;
    }

    let from = null;
    let to = null;
    const only = text.match(/Operates only on (\d{4}-\d{2}-\d{2})/);
    const range = text.match(/Effective (\d{4}-\d{2}-\d{2}) through (\d{4}-\d{2}-\d{2})/);
    const since = text.match(/Effective from (\d{4}-\d{2}-\d{2})/);
    const until = text.match(/Valid until (\d{4}-\d{2}-\d{2})/);
    if (only) {
      from = only[1];
      to = only[1];
    } else if (range) {
      from = range[1];
      to = range[2];
    } else if (since) {
      from = since[1];
    } else if (until) {
      to = until[1];
    }

    rows.push({
      weekdays: weekdays[1].split(","),
      departure: times[0],
      arrival: times[1],
      origin: airports[0],
      destination: airports[1],
      number: Number(flight[1]),
      from,
      to
    });
  }

  return { horizon, rows };
}

// Compares one flight with the parsed timetable. Statuses:
//   ok         - the timetable has this flight on that day at the same times
//   changed    - the flight runs that day but at different times
//   missing    - the timetable covers that day and the flight is not in it
//   unverified - the timetable is not published that far ahead yet
export function checkFlight(flight, schedule) {
  const weekday = WEEKDAYS[new Date(`${flight.date}T00:00:00Z`).getUTCDay()];
  const onDay = schedule.rows.filter(
    (row) =>
      row.number === flight.number &&
      row.origin === flight.origin &&
      row.destination === flight.destination &&
      row.weekdays.includes(weekday) &&
      (!row.from || row.from <= flight.date) &&
      (!row.to || row.to >= flight.date)
  );

  if (onDay.some((row) => row.departure === flight.departure && row.arrival === flight.arrival)) {
    return { status: "ok", message: "matches the timetable" };
  }
  if (onDay.length > 0) {
    return {
      status: "changed",
      message: `timetable now shows ${onDay[0].departure} → ${onDay[0].arrival}`,
      departure: onDay[0].departure,
      arrival: onDay[0].arrival
    };
  }
  if (schedule.horizon && flight.date > schedule.horizon) {
    return { status: "unverified", message: `timetable only published until ${schedule.horizon}` };
  }
  return { status: "missing", message: "not in the timetable for that day" };
}
