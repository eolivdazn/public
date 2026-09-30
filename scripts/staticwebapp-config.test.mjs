import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The real deployment config: trip pages are public, the dashboard, its data and the API are not.
const config = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../staticwebapp.config.json", import.meta.url)), "utf-8"));

// Mirrors Static Web Apps matching: first rule whose route matches wins; a trailing * is a prefix wildcard.
function rolesFor(path) {
  const rule = config.routes.find((candidate) =>
    candidate.route.endsWith("*") ? path.startsWith(candidate.route.slice(0, -1)) : path === candidate.route
  );
  return rule ? rule.allowedRoles : ["anonymous"];
}

test("the dashboard, its data and the whole API require the approved role", () => {
  for (const path of ["/dashboard", "/dashboard/", "/dashboard/index.html", "/dashboard/assets/index.js", "/dashboard-data.json", "/api/expenses", "/api/photos", "/api/receipts", "/api/suggestions", "/api/audit"]) {
    assert.deepEqual(rolesFor(path), ["approved"], path);
  }
});

test("the index, trip pages, their assets, share cards and OG images are public", () => {
  for (const path of ["/", "/index.html", "/valencia2026.html", "/assets/trip-page.css", "/assets/auth-state.js", "/hero/valencia2026-800.webp", "/vendor/quick-expense.js", "/share/valencia2026.html", "/og/valencia2026.png"]) {
    assert.deepEqual(rolesFor(path), ["anonymous"], path);
  }
  assert.equal(
    config.routes.some((rule) => rule.route === "/*"),
    false,
    "a catch-all rule would put the public pages behind the login again"
  );
});

test("signing in returns to the page you were on, and pages stay out of search engines", () => {
  assert.equal(config.responseOverrides["401"].statusCode, 302);
  assert.equal(config.responseOverrides["401"].redirect, "/.auth/login/github?post_login_redirect_uri=.referrer");
  assert.equal(config.globalHeaders["X-Robots-Tag"], "noindex, nofollow");
  assert.equal(config.globalHeaders["X-Frame-Options"], "DENY");
});
