// Shows the schedule check of the upcoming flights. The flights come from flights.json, written
// by scripts/build-site.mjs; each one is checked when the page opens, by asking
// /api/flight-status (api/flight-status/), so the result is never older than that request.
//   Trip page: a line under each flight of the itinerary ("On schedule · checked 14:32",
//     "Schedule changed: now 21:10 → 23:00 · checked 14:32").
//   Trip index: the "Flight status" line of each card, with the icon of the trip's worst result.
// Without the API (a static preview) or when a check fails, the pages stay as they are.
// Copied to site/assets/ at build time.
(function () {
  if (!window.fetch) {
    return;
  }

  var slug = location.pathname.split("/").pop().replace(/\.html$/, "");
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-flight-status]"));

  // What a card says to screen readers, and how bad each result is when a trip has several.
  var CARD_LABELS = { ok: "on schedule", changed: "schedule changed", unverified: "not checked" };
  var SEVERITY = { ok: 0, unverified: 1, changed: 2 };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  // "missing" reads as a change too: both mean the page no longer matches the timetable.
  function stateOf(result) {
    return result.status === "missing" ? "changed" : result.status;
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

  function showOnItinerary(flight, result) {
    var stop = Array.prototype.slice.call(document.querySelectorAll(".timeline-body")).find(function (candidate) {
      return candidate.textContent.indexOf(flight.flightNumber) !== -1 && !candidate.querySelector(".flight-status");
    });
    if (!stop) {
      return;
    }
    var checked = new Date(result.checkedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    var line = document.createElement("p");
    line.className = "flight-status";
    line.setAttribute("data-state", stateOf(result));
    line.textContent = label(result) + " · checked " + checked;
    stop.appendChild(line);
  }

  // A card keeps the worst result of its trip's flights seen so far.
  function showOnCard(flight, result) {
    var card = cards.find(function (candidate) {
      return candidate.getAttribute("data-flight-status") === flight.tripSlug;
    });
    var state = stateOf(result);
    if (!card || !(state in SEVERITY)) {
      return;
    }
    var current = card.getAttribute("data-state");
    if (current && SEVERITY[current] >= SEVERITY[state]) {
      return;
    }
    card.setAttribute("data-state", state);
    var hiddenLabel = card.querySelector("[data-flight-status-label]");
    if (hiddenLabel) {
      hiddenLabel.textContent = ": " + CARD_LABELS[state];
    }
    card.hidden = false;
  }

  var onIndex = cards.length > 0;
  var show = onIndex ? showOnCard : showOnItinerary;
  var now = new Date();
  var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  fetch("flights.json", { cache: "no-cache" })
    .then(function (response) {
      return response.ok ? response.json() : [];
    })
    .then(function (flights) {
      var upcoming = (Array.isArray(flights) ? flights : []).filter(function (flight) {
        return flight.date >= today && (onIndex || flight.tripSlug === slug);
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
              /* This flight stays without a status. */
            });
        });
      }, Promise.resolve());
    })
    .catch(function () {
      /* No flight list or offline: the page is still complete without it. */
    });
})();
