import test from "node:test";
import assert from "node:assert/strict";
import { checkFlight, parseSchedule, parseTripFlights, scheduleUrl } from "./lib/flight-check.mjs";

const trip = { slug: "krakow2026", startDate: "2026-11-13", endDate: "2026-11-16" };

function scheduleRow({ weekdays, departure, arrival, number, validity }) {
  return `<tr class="odd">
<td style="padding: 4px 4px 4px 4px">${weekdays}
${departure}
<a href="/airport/GVA">Geneva (GVA)</a> 1
${arrival}
<a href="/airport/KRK">Krakow (KRK)</a> <br>
<a href="/airline/U2">EasyJet</a>
<a href="/flight/EasyJet_U2_${number}">U2 ${number}</a>

Non-stop Airbus A320 (320) 2:00
${validity}</td>
</tr>`;
}

function schedulePage(rows, horizon = "20261030") {
  return `<script>datePickerController.createDatePicker({ rangeLow:"20260101", rangeHigh:"${horizon}" });</script>
<div class="flightlist"><table>${rows.map(scheduleRow).join("\n")}</table></div>`;
}

const winterFriday = { weekdays: "Fri", departure: "17:45", arrival: "19:45", number: 1353, validity: "Effective from 2026-10-30" };
const outbound = {
  tripSlug: "krakow2026",
  date: "2026-11-13",
  origin: "GVA",
  destination: "KRK",
  airline: "EZS",
  number: 1353,
  flightNumber: "EZS1353",
  departure: "17:45",
  arrival: "19:45"
};

test("parseTripFlights reads the flights of an itinerary", () => {
  const markdown = [
    "## 🏰 Kraków Trip",
    "- **Fri 13 Nov** ✈️ Flight",
    "  GVA → KRK — EZS1353 (17:45 → 19:45)",
    "- **Mon 16 Nov** ✈️ Flight",
    "  KRK (T1) → GVA (T1) — EZS1354 (20:40 → 22:45)",
    "",
    "- **Sat 14 Nov** 🏭 Nowa Huta tour"
  ].join("\n");

  assert.deepEqual(parseTripFlights(markdown, trip), [
    outbound,
    {
      tripSlug: "krakow2026",
      date: "2026-11-16",
      origin: "KRK",
      destination: "GVA",
      airline: "EZS",
      number: 1354,
      flightNumber: "EZS1354",
      departure: "20:40",
      arrival: "22:45"
    }
  ]);
});

test("parseTripFlights keeps flights without a flight number so they can be reported", () => {
  const valencia = { slug: "valencia2026", startDate: "2026-10-16", endDate: "2026-10-19" };
  const flights = parseTripFlights("- **16 outubro** ✈️ Voo de ida · 18:05 ·", valencia);

  assert.deepEqual(flights, [
    { tripSlug: "valencia2026", date: "2026-10-16", flightNumber: null, description: "✈️ Voo de ida · 18:05 ·" }
  ]);
});

test("parseTripFlights takes the year from the trip dates", () => {
  const newYear = { slug: "trip", startDate: "2026-12-29", endDate: "2027-01-03" };
  const flights = parseTripFlights("- **Sun 03 Jan** ✈️ Flight\n  HRG → GVA — EZS1594 (13:00 → 17:10)", newYear);

  assert.equal(flights[0].date, "2027-01-03");
});

test("scheduleUrl points at the airline's route page and is null for unknown airlines", () => {
  assert.equal(scheduleUrl(outbound), "https://info.flightmapper.net/route/EasyJet_U2_GVA_KRK");
  assert.equal(scheduleUrl({ ...outbound, airline: "TAP" }), null);
});

test("parseSchedule reads rows, validity periods and the published horizon", () => {
  const schedule = parseSchedule(
    schedulePage([
      winterFriday,
      { weekdays: "Thu,Sun", departure: "13:10", arrival: "15:10", number: 1447, validity: "Effective 2026-04-02 through 2026-06-18" },
      { weekdays: "Mon", departure: "18:10", arrival: "20:10", number: 1353, validity: "Valid until 2026-03-23" },
      { weekdays: "Tue", departure: "16:45", arrival: "18:45", number: 1353, validity: "Operates only on 2026-10-27" }
    ])
  );

  assert.equal(schedule.horizon, "2026-10-30");
  assert.deepEqual(schedule.rows, [
    { weekdays: ["Fri"], departure: "17:45", arrival: "19:45", origin: "GVA", destination: "KRK", number: 1353, from: "2026-10-30", to: null },
    { weekdays: ["Thu", "Sun"], departure: "13:10", arrival: "15:10", origin: "GVA", destination: "KRK", number: 1447, from: "2026-04-02", to: "2026-06-18" },
    { weekdays: ["Mon"], departure: "18:10", arrival: "20:10", origin: "GVA", destination: "KRK", number: 1353, from: null, to: "2026-03-23" },
    { weekdays: ["Tue"], departure: "16:45", arrival: "18:45", origin: "GVA", destination: "KRK", number: 1353, from: "2026-10-27", to: "2026-10-27" }
  ]);
});

test("checkFlight passes when the timetable still has the same times", () => {
  const result = checkFlight(outbound, parseSchedule(schedulePage([winterFriday])));
  assert.equal(result.status, "ok");
});

test("checkFlight reports the new times when the flight was retimed", () => {
  const retimed = { ...winterFriday, departure: "18:30", arrival: "20:30" };
  const result = checkFlight(outbound, parseSchedule(schedulePage([retimed])));

  assert.equal(result.status, "changed");
  assert.equal(result.departure, "18:30");
  assert.equal(result.arrival, "20:30");
});

test("checkFlight ignores rows for other periods of the year", () => {
  const summerOnly = { ...winterFriday, departure: "10:50", arrival: "12:50", validity: "Effective 2026-06-25 through 2026-08-27" };
  const result = checkFlight(outbound, parseSchedule(schedulePage([summerOnly, winterFriday])));
  assert.equal(result.status, "ok");
});

test("checkFlight reports a flight missing from a timetable that covers its date", () => {
  const mondayOnly = { ...winterFriday, weekdays: "Mon" };
  const result = checkFlight(outbound, parseSchedule(schedulePage([mondayOnly], "20261231")));
  assert.equal(result.status, "missing");
});

test("checkFlight cannot verify a flight beyond the published timetable", () => {
  const summerOnly = { ...winterFriday, validity: "Effective 2026-06-25 through 2026-08-27" };
  const result = checkFlight(outbound, parseSchedule(schedulePage([summerOnly])));
  assert.equal(result.status, "unverified");
});
