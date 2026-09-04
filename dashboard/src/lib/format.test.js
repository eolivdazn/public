import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatAuditTimestamp } from "./format.js";

test("formatCurrency returns em dash for zero amount with no currency", () => {
  assert.equal(formatCurrency(0, null), "—");
});

test("formatCurrency returns raw string for non-zero amount with no currency", () => {
  assert.equal(formatCurrency(42, null), "42");
});

test("formatCurrency formats whole numbers without decimals", () => {
  assert.equal(formatCurrency(100, "EUR"), "€100");
});

test("formatCurrency formats fractional numbers with two decimals", () => {
  assert.equal(formatCurrency(99.5, "EUR"), "€99.50");
});

test("formatAuditTimestamp formats a valid ISO timestamp as a readable date and time", () => {
  const result = formatAuditTimestamp("2026-09-03T14:05:00.000Z");
  assert.match(result, /^\d{1,2} \w+ \d{4}, \d{2}:\d{2}$/);
});

test("formatAuditTimestamp falls back to the original string for an invalid date", () => {
  assert.equal(formatAuditTimestamp("not-a-date"), "not-a-date");
});
