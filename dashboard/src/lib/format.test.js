import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency } from "./format.js";

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
