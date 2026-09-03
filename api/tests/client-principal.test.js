const test = require("node:test");
const assert = require("node:assert/strict");

const { getClientPrincipal } = require("../lib/client-principal");

function encodePrincipal(principal) {
  return Buffer.from(JSON.stringify(principal), "utf-8").toString("base64");
}

test("getClientPrincipal returns null when the header is missing", () => {
  assert.equal(getClientPrincipal({ headers: {} }), null);
  assert.equal(getClientPrincipal({ headers: undefined }), null);
});

test("getClientPrincipal returns null for malformed headers", () => {
  assert.equal(getClientPrincipal({ headers: { "x-ms-client-principal": "not-base64-json" } }), null);
  assert.equal(
    getClientPrincipal({ headers: { "x-ms-client-principal": Buffer.from("{}").toString("base64") } }),
    null
  );
});

test("getClientPrincipal decodes a valid SWA client principal header", () => {
  const header = encodePrincipal({
    identityProvider: "github",
    userId: "u1",
    userDetails: "eduardo.oliveira",
    userRoles: ["anonymous", "authenticated", "approved"]
  });

  const principal = getClientPrincipal({ headers: { "x-ms-client-principal": header } });

  assert.deepEqual(principal, {
    userId: "u1",
    userDetails: "eduardo.oliveira",
    identityProvider: "github",
    userRoles: ["anonymous", "authenticated", "approved"]
  });
});
