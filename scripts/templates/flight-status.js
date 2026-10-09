// Adds the schedule check under each flight of the itinerary ("On schedule · checked 9 Oct",
// "Schedule changed: now 21:10 → 23:00 · checked 9 Oct"), from flight-status.json, which
// scripts/check-flights.mjs writes at deploy time. Without that file (local builds) or without an
// entry for a flight (past flights, flights with no number), the page stays as it is.
// Copied to site/assets/ at build time.
(function () {
  var slug = location.pathname.split("/").pop().replace(/\.html$/, "");
  if (!slug || !window.fetch) {
    return;
  }

  function label(flight) {
    if (flight.status === "ok") {
      return "On schedule";
    }
    if (flight.status === "changed") {
      return "Schedule changed: now " + flight.departure + " → " + flight.arrival;
    }
    if (flight.status === "missing") {
      return "Not in the timetable for this day";
    }
    return "Not checked: " + flight.message;
  }

  fetch("flight-status.json", { cache: "no-cache" })
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (report) {
      if (!report || !Array.isArray(report.flights)) {
        return;
      }
      var checked = new Date(report.checkedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
      var stops = Array.prototype.slice.call(document.querySelectorAll(".timeline-body"));

      report.flights.forEach(function (flight) {
        if (flight.tripSlug !== slug || !flight.flightNumber) {
          return;
        }
        var stop = stops.find(function (candidate) {
          return candidate.textContent.indexOf(flight.flightNumber) !== -1 && !candidate.querySelector(".flight-status");
        });
        if (!stop) {
          return;
        }
        var line = document.createElement("p");
        line.className = "flight-status";
        // "missing" reads as a change too: both mean the page no longer matches the timetable.
        line.setAttribute("data-state", flight.status === "missing" ? "changed" : flight.status);
        line.textContent = label(flight) + " · checked " + checked;
        stop.appendChild(line);
      });
    })
    .catch(function () {
      /* No status file or offline: the itinerary is still complete without it. */
    });
})();
