// Adds the schedule check under each upcoming flight of the itinerary ("On schedule · checked
// 14:32", "Schedule changed: now 21:10 → 23:00 · checked 14:32"). The flights come from
// flights.json, written by scripts/build-site.mjs; each one is checked when the page opens, by
// asking /api/flight-status (api/flight-status/), so the line is never older than that request.
// Without the API (a static preview) or when a check fails, the page stays as it is.
// Copied to site/assets/ at build time.
(function () {
  var slug = location.pathname.split("/").pop().replace(/\.html$/, "");
  if (!slug || !window.fetch) {
    return;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function label(result) {
    if (result.status === "ok") {
      return "On schedule";
    }
    if (result.status === "changed") {
      return "Schedule changed: now " + result.departure + " → " + result.arrival;
    }
    if (result.status === "missing") {
      return "Not in the timetable for this day";
    }
    return "Not checked: " + result.message;
  }

  function check(flight) {
    var params = new URLSearchParams({
      airline: flight.airline,
      number: flight.number,
      from: flight.origin,
      to: flight.destination,
      date: flight.date,
      dep: flight.departure,
      arr: flight.arrival
    });
    return fetch("/api/flight-status?" + params.toString()).then(function (response) {
      return response.ok ? response.json() : null;
    });
  }

  function show(flight, result) {
    var stop = Array.prototype.slice.call(document.querySelectorAll(".timeline-body")).find(function (candidate) {
      return candidate.textContent.indexOf(flight.flightNumber) !== -1 && !candidate.querySelector(".flight-status");
    });
    if (!stop) {
      return;
    }
    var checked = new Date(result.checkedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    var line = document.createElement("p");
    line.className = "flight-status";
    // "missing" reads as a change too: both mean the page no longer matches the timetable.
    line.setAttribute("data-state", result.status === "missing" ? "changed" : result.status);
    line.textContent = label(result) + " · checked " + checked;
    stop.appendChild(line);
  }

  var now = new Date();
  var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  fetch("flights.json", { cache: "no-cache" })
    .then(function (response) {
      return response.ok ? response.json() : [];
    })
    .then(function (flights) {
      var upcoming = (Array.isArray(flights) ? flights : []).filter(function (flight) {
        return flight.tripSlug === slug && flight.date >= today;
      });
      // One at a time: the timetable site refuses requests that come too close together.
      return upcoming.reduce(function (previous, flight) {
        return previous.then(function () {
          return check(flight)
            .then(function (result) {
              if (result && result.status) {
                show(flight, result);
              }
            })
            .catch(function () {
              /* This flight stays without a status line. */
            });
        });
      }, Promise.resolve());
    })
    .catch(function () {
      /* No flight list or offline: the itinerary is still complete without it. */
    });
})();
