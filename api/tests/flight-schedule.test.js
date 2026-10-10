const test = require("node:test");
const assert = require("node:assert/strict");

const { createScheduleLoader } = require("../lib/flight-schedule");

const URL = "https://info.flightmapper.net/route/EasyJet_U2_GVA_VLC";
const PAGE = '<script>datePickerController.createDatePicker({ rangeHigh:"20261030" });</script>';

function okResponse() {
  return { ok: true, status: 200, text: async () => PAGE };
}

function failedResponse(status) {
  return { ok: false, status, text: async () => "" };
}

// A fetch stand-in that answers with the queued responses, in order, and counts the calls.
function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const next = responses.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next;
  };
  return { fetchImpl, calls };
}

test("loadSchedule parses the timetable page and says when it was fetched", async () => {
  const { fetchImpl, calls } = fakeFetch([okResponse()]);
  const loadSchedule = createScheduleLoader({ fetchImpl, now: () => 1000 });

  const result = await loadSchedule(URL);

  assert.deepEqual(calls, [URL]);
  assert.equal(result.schedule.horizon, "2026-10-30");
  assert.equal(result.fetchedAt, 1000);
});

test("loadSchedule answers from memory within the TTL and fetches again after it", async () => {
  let clock = 0;
  const { fetchImpl, calls } = fakeFetch([okResponse(), okResponse()]);
  const loadSchedule = createScheduleLoader({ fetchImpl, now: () => clock, ttlMs: 1000 });

  await loadSchedule(URL);
  clock = 999;
  const cached = await loadSchedule(URL);
  assert.equal(calls.length, 1);
  assert.equal(cached.fetchedAt, 0);

  clock = 1000;
  const fresh = await loadSchedule(URL);
  assert.equal(calls.length, 2);
  assert.equal(fresh.fetchedAt, 1000);
});

test("loadSchedule tries once more when the timetable site answers 503", async () => {
  const { fetchImpl, calls } = fakeFetch([failedResponse(503), okResponse()]);
  const loadSchedule = createScheduleLoader({ fetchImpl, retryDelayMs: 0 });

  const result = await loadSchedule(URL);

  assert.equal(calls.length, 2);
  assert.equal(result.schedule.horizon, "2026-10-30");
});

test("loadSchedule does not cache a failure", async () => {
  const { fetchImpl, calls } = fakeFetch([failedResponse(503), new Error("network down"), okResponse()]);
  const loadSchedule = createScheduleLoader({ fetchImpl, retryDelayMs: 0 });

  await assert.rejects(loadSchedule(URL), /network down/);
  const result = await loadSchedule(URL);

  assert.equal(calls.length, 3);
  assert.equal(result.schedule.horizon, "2026-10-30");
});
