// Fills every [data-trip-status] pill ("Starts in 17 days", "Happening now · day 3 of 4",
// "Trip completed") against the viewer's local date — the pages themselves are static.
// Shared by the trip pages and the trip index; copied to site/assets/ at build time.
(function () {
  var DAY_MS = 86400000;
  var today = new Date();
  var todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  document.querySelectorAll("[data-trip-status]").forEach(function (pill) {
    var start = Date.parse(pill.getAttribute("data-start") + "T00:00:00Z");
    var end = Date.parse(pill.getAttribute("data-end") + "T00:00:00Z");
    var label;
    var state;

    if (todayUtc < start) {
      var daysLeft = Math.round((start - todayUtc) / DAY_MS);
      label = daysLeft === 1 ? "Starts tomorrow" : "Starts in " + daysLeft + " days";
      state = "upcoming";
    } else if (todayUtc <= end) {
      var day = Math.round((todayUtc - start) / DAY_MS) + 1;
      var total = Math.round((end - start) / DAY_MS) + 1;
      label = "Happening now · day " + day + " of " + total;
      state = "live";
    } else {
      label = "Trip completed";
      state = "past";
    }

    pill.textContent = label;
    pill.setAttribute("data-state", state);
    pill.hidden = false;
  });
})();
