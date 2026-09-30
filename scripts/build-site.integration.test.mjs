import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runBuild, headingShiftFor } from "./build-site.mjs";

const FIXTURE_TRIP_MD = `---
title: "🧪 Test Trip"
slug: test-trip
favicon: "🧪"
description: "A fixture trip used by the build pipeline integration test."
seoTitle: "🧪 Test Trip Guide — A Fixture Adventure"
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

  beforeAll(async () => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-site-fixture-"));
    outputDir = path.join(sourceDir, "site");
    fs.writeFileSync(path.join(sourceDir, "test-trip.md"), FIXTURE_TRIP_MD);
    fs.writeFileSync(path.join(sourceDir, "staticwebapp.config.json"), FIXTURE_CONFIG);

    await runBuild({ sourceDir, outputDir });
  });

  afterAll(() => {
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it("writes exactly one <title> and one description meta tag, using the longer seoTitle (not the short display title)", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect((html.match(/<title>/g) || []).length).toBe(1);
    expect((html.match(/name="description"/g) || []).length).toBe(1);
    expect(html).toContain("<title>🧪 Test Trip Guide — A Fixture Adventure</title>");
  });

  it("includes correct Open Graph and Twitter Card tags", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect(html).toContain('<meta property="og:title" content="🧪 Test Trip Guide — A Fixture Adventure" />');
    expect(html).toContain(
      '<meta property="og:url" content="https://white-stone-0b0565103.5.azurestaticapps.net/test-trip.html" />'
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://white-stone-0b0565103.5.azurestaticapps.net/og/test-trip.png" />'
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it("renders the trip page with the custom template: hero from frontmatter, shifted headings, shared stylesheet", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect(html).toContain('<link rel="stylesheet" href="assets/trip-page.css" />');
    expect((html.match(/<h1[ >]/g) || []).length).toBe(1);
    expect(html).toContain('<h1 id="trip-title">🧪 Test Trip</h1>');
    expect(html).toContain("1–3 May 2026");
    expect(html).toContain("<span>Testville, Testland</span>");
    expect(html).toContain("<dt>Booked</dt><dd>€300</dd>");
    expect(html).toContain("<dt>Per person (2)</dt><dd>€150</dd>");
    // The fixture's top heading is "##", so it renders as <h2> directly under the hero <h1> (no skipped level).
    expect(html).toMatch(/<h2 id="test-trip">Test Trip<\/h2>/);
    expect(html).not.toMatch(/<h3[ >]/);
    expect(html).toContain('href="/share/test-trip.html"');
    expect(html).toContain('id="trip-quick-expense-root"');
    // Food gallery: hidden section + full-screen viewer, driven by the shared asset.
    expect(html).toContain('<section id="trip-food-gallery" class="trip-food-gallery" aria-labelledby="trip-food-gallery-title" hidden>');
    expect(html).toContain('<dialog id="trip-food-lightbox" class="trip-lightbox" aria-label="Food photos">');
    expect(html).toContain('<script src="assets/trip-food-gallery.js" defer></script>');
    expect(fs.existsSync(path.join(outputDir, "assets", "trip-food-gallery.js"))).toBe(true);
    // Head metadata belongs in <head>, not the body.
    expect(html.indexOf('property="og:title"')).toBeLessThan(html.indexOf("</head>"));
    expect(fs.existsSync(path.join(outputDir, "assets", "trip-page.css"))).toBe(true);
  });

  it("has no environment label on a default (prod) build", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    const indexHtml = fs.readFileSync(path.join(outputDir, "index.html"), "utf-8");
    expect(html + indexHtml).not.toContain("env-badge");
    expect(html + indexHtml).not.toContain("[Stage]");
    expect(html).toContain('<header class="app-bar">');
  });

  it("uses the favicon emblem instead of a hero photo when the trip has no ogImage", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect(html).toContain('class="trip-hero-emblem"');
    expect(html).not.toContain("trip-hero-image");
    // Full-width cover: no photo -> brand gradient variant; the dates line also gives the length.
    expect(html).toContain('<section class="trip-hero no-image" aria-labelledby="trip-title">');
    expect(html).toMatch(/<div class="trip-hero-cover">[\s\S]*<h1 id="trip-title">/);
    expect(html).toContain('<span aria-hidden="true">·</span><span>3 days</span>');
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

  it("keeps the share card self-contained: no gated assets, inline styles, emblem when there is no photo", () => {
    const shareHtml = fs.readFileSync(path.join(outputDir, "share", "test-trip.html"), "utf-8");
    // /share/* is public but assets/ and hero/ are gated behind sign-in.
    expect(shareHtml).not.toContain("assets/");
    expect(shareHtml).not.toContain("hero/");
    expect(shareHtml).toContain("<style>");
    expect(shareHtml).toContain('<h1>🧪 Test Trip</h1>');
    expect(shareHtml).toContain("1–3 May 2026 · 3 days");
    expect(shareHtml).toContain("Testville, Testland");
    expect(shareHtml).toContain('class="share-emblem"');
  });

  it("renders the trip index as year-grouped cards linking to each trip page", () => {
    const indexHtml = fs.readFileSync(path.join(outputDir, "index.html"), "utf-8");
    expect(indexHtml).toContain('<link rel="stylesheet" href="assets/trip-page.css" />');
    expect(indexHtml).toContain('<h2 id="year-2026">2026</h2>');
    expect(indexHtml).toContain('<a class="trip-card" href="test-trip.html">');
    expect(indexHtml).toContain('<h3 class="trip-card-title">🧪 Test Trip</h3>');
    expect(indexHtml).toContain("3 days · €300 booked");
    expect(indexHtml).toContain("1 trip · 3 days · 1 country");
    expect(indexHtml).toContain('<meta name="description" content="Itineraries, dates and booked costs for 1 trip across 1 year." />');
    expect(indexHtml).toContain('href="dashboard/"');
    expect(fs.existsSync(path.join(outputDir, "assets", "trip-status.js"))).toBe(true);
  });

  it("writes dashboard-data.json with the fixture trip, keeping the short title distinct from seoTitle", () => {
    const data = JSON.parse(fs.readFileSync(path.join(outputDir, "dashboard-data.json"), "utf-8"));
    const trip = data.trips.find((item) => item.slug === "test-trip");
    expect(trip).toBeTruthy();
    expect(trip.title).toBe("🧪 Test Trip");
    expect(trip.seoTitle).toBe("🧪 Test Trip Guide — A Fixture Adventure");
  });

  it("copies staticwebapp.config.json through unchanged", () => {
    const config = JSON.parse(fs.readFileSync(path.join(outputDir, "staticwebapp.config.json"), "utf-8"));
    expect(config.routes).toEqual([{ route: "/*", allowedRoles: ["approved"] }]);
  });
});

describe("runBuild with SITE_ORIGIN / SITE_ENV / SITE_REF (stage builds)", () => {
  let sourceDir;
  let outputDir;
  const STAGE_ENV = { SITE_ORIGIN: "https://stage.example.test/", SITE_ENV: "stage", SITE_REF: "feature/<x>" };
  const previousEnv = {};

  beforeAll(async () => {
    for (const [key, value] of Object.entries(STAGE_ENV)) {
      previousEnv[key] = process.env[key];
      process.env[key] = value;
    }
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-site-origin-fixture-"));
    outputDir = path.join(sourceDir, "site");
    fs.writeFileSync(path.join(sourceDir, "test-trip.md"), FIXTURE_TRIP_MD);

    await runBuild({ sourceDir, outputDir });
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it("uses SITE_ORIGIN (trailing slash trimmed) for absolute URLs instead of the prod host", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect(html).toContain('<meta property="og:url" content="https://stage.example.test/test-trip.html" />');
    expect(html).toContain('<meta property="og:image" content="https://stage.example.test/og/test-trip.png" />');
    const shareHtml = fs.readFileSync(path.join(outputDir, "share", "test-trip.html"), "utf-8");
    expect(shareHtml).toContain('<meta property="og:url" content="https://stage.example.test/share/test-trip.html" />');
    expect(html + shareHtml).not.toContain("white-stone-0b0565103");
  });

  it("labels stage pages: top-bar badge with the (escaped) branch name and a [Stage] tab title", () => {
    const html = fs.readFileSync(path.join(outputDir, "test-trip.html"), "utf-8");
    expect(html).toContain("<title>[Stage] 🧪 Test Trip Guide — A Fixture Adventure</title>");
    expect(html).toContain('<header class="app-bar is-env">');
    expect(html).toContain('<span class="env-badge-ref">feature/&lt;x&gt;</span>');
    const indexHtml = fs.readFileSync(path.join(outputDir, "index.html"), "utf-8");
    expect(indexHtml).toContain("<title>[Stage] Travel Pages</title>");
    expect(indexHtml).toContain('class="env-badge"');
  });
});

describe("runBuild ogImage (real network fetch + sharp crop, no mocking)", () => {
  let sourceDir;
  let outputDir;

  const PHOTO_TRIP_MD = `---
title: "📷 Photo Trip"
slug: photo-trip
favicon: "📷"
description: "A fixture trip that points ogImage at a real, reachable photo URL."
ogImage: "https://picsum.photos/id/1015/1600/900"
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
---

## Photo Trip
`;

  const BROKEN_PHOTO_TRIP_MD = PHOTO_TRIP_MD.replace('slug: photo-trip', 'slug: broken-photo-trip').replace(
    'ogImage: "https://picsum.photos/id/1015/1600/900"',
    'ogImage: "https://this-domain-does-not-exist-12345.example/photo.jpg"'
  );

  beforeAll(async () => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-site-photo-fixture-"));
    outputDir = path.join(sourceDir, "site");
    fs.writeFileSync(path.join(sourceDir, "photo-trip.md"), PHOTO_TRIP_MD);
    fs.writeFileSync(path.join(sourceDir, "broken-photo-trip.md"), BROKEN_PHOTO_TRIP_MD);
    fs.writeFileSync(path.join(sourceDir, "staticwebapp.config.json"), FIXTURE_CONFIG);

    await runBuild({ sourceDir, outputDir });
  });

  afterAll(() => {
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it("fetches and crops a real ogImage URL to a 1200x630 PNG", () => {
    const pngPath = path.join(outputDir, "og", "photo-trip.png");
    const buffer = fs.readFileSync(pngPath);
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);
  });

  it("writes WebP hero renditions from the ogImage and uses them on the trip page", () => {
    for (const width of [800, 1600]) {
      const webpPath = path.join(outputDir, "hero", `photo-trip-${width}.webp`);
      const buffer = fs.readFileSync(webpPath);
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(buffer.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
    const html = fs.readFileSync(path.join(outputDir, "photo-trip.html"), "utf-8");
    expect(html).toContain('srcset="hero/photo-trip-800.webp 800w, hero/photo-trip-1600.webp 1600w"');
    // The share card is public, so it gets its photo from og/ rather than the gated hero/.
    expect(fs.existsSync(path.join(outputDir, "og", "photo-trip.webp"))).toBe(true);
    const shareHtml = fs.readFileSync(path.join(outputDir, "share", "photo-trip.html"), "utf-8");
    expect(shareHtml).toContain('src="/og/photo-trip.webp"');
    const indexHtml = fs.readFileSync(path.join(outputDir, "index.html"), "utf-8");
    expect(indexHtml).toContain('src="hero/photo-trip-800.webp"');
  });

  it("skips the hero photo when ogImage is unreachable", () => {
    const html = fs.readFileSync(path.join(outputDir, "broken-photo-trip.html"), "utf-8");
    expect(html).toContain('class="trip-hero-emblem"');
    expect(fs.existsSync(path.join(outputDir, "hero", "broken-photo-trip-800.webp"))).toBe(false);
  });

  it("falls back to the generated title card when ogImage is unreachable", () => {
    const pngPath = path.join(outputDir, "og", "broken-photo-trip.png");
    const buffer = fs.readFileSync(pngPath);
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);
  });
});

describe("headingShiftFor", () => {
  it("maps each file's top heading level to <h2> under the hero <h1>", () => {
    expect(headingShiftFor("# Section\n## Sub")).toBe(1);
    expect(headingShiftFor("## Section\n### Sub")).toBe(0);
    // Order doesn't matter: the highest level anywhere in the file wins.
    expect(headingShiftFor("## Intro\n# Section")).toBe(1);
  });

  it("ignores the frontmatter and fenced code, and defaults to 1 without headings", () => {
    expect(headingShiftFor("---\ntitle: x\n---\n```\n# not a heading\n```\n## Real")).toBe(0);
    expect(headingShiftFor("#hashtag, not a heading\n## Real")).toBe(0);
    expect(headingShiftFor("just text")).toBe(1);
  });
});
