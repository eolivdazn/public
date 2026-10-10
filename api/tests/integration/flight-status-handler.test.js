import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

// See expenses-handler.test.js for why this uses require.cache injection instead of vi.mock.
const require = createRequire(import.meta.url);
const scheduleModulePath = require.resolve("../../lib/flight-schedule");
const handlerModulePath = require.resolve("../../flight-status/index.js");

const loadSchedule = vi.fn();
const mockScheduleModule = { createScheduleLoader: () => loadSchedule };

const FETCHED_AT = Date.parse("2026-10-10T12:00:00.000Z");
const outbound = { airline: "EZS", number: "1371", from: "GVA", to: "VLC", date: "2026-10-16", dep: "18:05", arr: "19:55" };

// The timetable as flight-check.js parses it: EZS1371 on Fridays (16 Oct 2026 is a Friday).
function timetable({ departure = "18:05", arrival = "19:55" } = {}) {
  return {
    horizon: "2026-10-24",
    rows: [{ weekdays: ["Fri"], departure, arrival, origin: "GVA", destination: "VLC", number: 1371, from: null, to: null }]
  };
}

describe("flight-status API handler", () => {
  let flightStatusApi;

  beforeEach(() => {
    vi.clearAllMocks();
    require.cache[scheduleModulePath] = { id: scheduleModulePath, filename: scheduleModulePath, loaded: true, exports: mockScheduleModule };
    delete require.cache[handlerModulePath];
    flightStatusApi = require("../../flight-status/index.js");
  });

  afterEach(() => {
    delete require.cache[scheduleModulePath];
    delete require.cache[handlerModulePath];
  });

  async function call(query, method = "GET") {
    const context = {};
    await flightStatusApi(context, { method, query });
    return context.res;
  }

  it("says a flight is on schedule when the timetable has the same times", async () => {
    loadSchedule.mockResolvedValue({ schedule: timetable(), fetchedAt: FETCHED_AT });

    const res = await call(outbound);

    expect(loadSchedule).toHaveBeenCalledWith("https://info.flightmapper.net/route/EasyJet_U2_GVA_VLC");
    expect(res.status).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.body).toEqual({ status: "ok", message: "matches the timetable", checkedAt: "2026-10-10T12:00:00.000Z" });
  });

  it("returns the new times when the flight was retimed", async () => {
    loadSchedule.mockResolvedValue({ schedule: timetable({ departure: "19:10", arrival: "21:00" }), fetchedAt: FETCHED_AT });

    const res = await call(outbound);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "changed", departure: "19:10", arrival: "21:00" });
  });

  it("reports the flight as not checked when the timetable cannot be loaded", async () => {
    loadSchedule.mockRejectedValue(new Error("HTTP 503"));

    const res = await call(outbound);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "unverified", message: "timetable could not be loaded (HTTP 503)" });
  });

  it("reports airlines without a timetable source as not checked, without fetching", async () => {
    const res = await call({ ...outbound, airline: "TP" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "unverified", message: "no timetable source for TP flights" });
    expect(loadSchedule).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing parameter", { ...outbound, dep: undefined }, "dep"],
    ["an airport that is not an IATA code", { ...outbound, from: "../x" }, "from"],
    ["a flight number with other characters", { ...outbound, number: "13/71" }, "number"],
    ["a date that does not exist", { ...outbound, date: "2026-13-45" }, "date"]
  ])("rejects %s", async (_name, query, parameter) => {
    const res = await call(query);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(parameter);
    expect(loadSchedule).not.toHaveBeenCalled();
  });

  it("only accepts GET", async () => {
    const res = await call(outbound, "POST");

    expect(res.status).toBe(405);
    expect(res.headers.Allow).toBe("GET");
  });
});
