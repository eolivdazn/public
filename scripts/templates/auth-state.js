// Signed-in vs signed-out chrome on the public pages (index and trip pages). Those pages no
// longer require a login (see staticwebapp.config.json), so without a session the top bar offers
// "Sign in" instead of "Dashboard" (the dashboard and the API still require the approved role).
//
//   [data-auth-show="signed-in"]  visible by default, hidden when there is no session
//   [data-auth-show="signed-out"] hidden by default, shown when there is no session
//
// If /.auth/me can't be reached (e.g. a plain local server), nothing changes.
// Copied to site/assets/ at build time (build-site.mjs).
(function () {
  "use strict";

  fetch("/.auth/me", { credentials: "same-origin" })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (payload) {
      if (!payload || payload.clientPrincipal) {
        return;
      }
      // Come back to this exact page after signing in.
      var loginUrl = "/.auth/login/github?post_login_redirect_uri=" + encodeURIComponent(location.href);
      document.querySelectorAll('[data-auth-show="signed-out"]').forEach(function (node) {
        if (node.tagName === "A") {
          node.href = loginUrl;
        }
        node.hidden = false;
      });
      document.querySelectorAll('[data-auth-show="signed-in"]').forEach(function (node) {
        node.hidden = true;
      });
    })
    .catch(function () {
      /* No auth endpoint (local server) — keep the default chrome. */
    });
})();
