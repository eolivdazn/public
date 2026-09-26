import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runBuild } from "./build-site.mjs";

const FIXTURE_TRIP_MD = `---
title: "🧪 Test Trip"
slug: test-trip
favicon: "🧪"
description: "A fixture trip used by the build pipeline integration test."
schema: travel-dashboard/v1
tripType: vacation
startDate: "2026-05-01"
endDate: "2026-05-03"
year: 2026
dateCounting: inclusive
places:
  - city: Testville
    country: Testland
    startDate: "2026-05-01"
    endDate: "2026-05-03"
expenses:
  baseCurrency: EUR
  partySize: 2
  categories:
    flights: 100
    hotel: 200
    food: 0
    entertainment: 0
---

## Test Trip

- Day one: arrive.
`;

const FIXTURE_CONFIG = JSON.stringify({
  routes: [{ route: "/*", allowedRoles: ["approved"] }],
  responseOverrides: { "401": { statusCode: 302, redirect: "/.auth/login/github" } }
});

describe("runBuild (real pandoc + resvg, fixture content dir)", () => {
  let sourceDir;
  let outputDir;

  beforeAll(() => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-site-fixture-"));
    outputDir = path.join(sourceDir, "site");
    fs.writeFileSync(path.join(sourceDir, "test-trip.md"), FIXTURE_TRIP_MD);
    fs.writeFileSync(path.join(sourceDir, "staticwebapp.config.json"), FIXTURE_CONFIG);

    runBuild({ sourceDir, outputDir });
  });

  afterAll(() => {
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it("writes exactly one <title> and one description meta tag, no duplicates", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect((html.match(/<title>/g) || []).length).toBe(1);
    expect((html.match(/name="description"/g) || []).length).toBe(1);
    expect(html).toContain("<title>🧪 Test Trip</title>");
  });

  it("includes correct Open Graph and Twitter Card tags", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect(html).toContain('<meta property="og:title" content="🧪 Test Trip" />');
    expect(html).toContain(
      '<meta property="og:url" content="https://white-stone-0b0565103.5.azurestaticapps.net/test-trip.html" />'
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://white-stone-0b0565103.5.azurestaticapps.net/og/test-trip.png" />'
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it("generates a valid 1200x630 PNG preview image", () => {
    const pngPath = path.join(outputDir, "og", "test-trip.png");
    expect(fs.existsSync(pngPath)).toBe(true);

    const buffer = fs.readFileSync(pngPath);
    // PNG magic bytes.
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // IHDR chunk: width/height are the first 8 bytes after the 8-byte magic + 4-byte length + 4-byte "IHDR".
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  it("generates a public share card that links to the real (gated) page", () => {
    const shareHtml = fs.readFileSync(path.join(outputDir, "share", "test-trip.html"), "utf-8");
    expect(shareHtml).toContain("Sign in to view this trip");
    expect(shareHtml).toContain('href="/test-trip.html"');
    expect(shareHtml).toContain(
      '<meta property="og:url" content="https://white-stone-0b0565103.5.azurestaticapps.net/share/test-trip.html" />'
    );
  });

  it("writes dashboard-data.json with the fixture trip", () => {
    const data = JSON.parse(fs.readFileSync(path.join(outputDir, "dashboard-data.json"), "utf-8"));
    const trip = data.trips.find((item) => item.slug === "test-trip");
    expect(trip).toBeTruthy();
    expect(trip.title).toBe("🧪 Test Trip");
  });

  it("copies staticwebapp.config.json through unchanged", () => {
    const config = JSON.parse(fs.readFileSync(path.join(outputDir, "staticwebapp.config.json"), "utf-8"));
    expect(config.routes).toEqual([{ route: "/*", allowedRoles: ["approved"] }]);
  });
});
