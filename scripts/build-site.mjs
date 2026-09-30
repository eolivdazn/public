import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { buildDashboardData, loadTripEntries } from "./lib/travel-data.mjs";

const PROD_ORIGIN = "https://white-stone-0b0565103.5.azurestaticapps.net";

// Absolute URLs in OG/Twitter tags and share cards. The stage workflow sets SITE_ORIGIN to the
// stage host so its pages don't advertise prod URLs; unset (prod, local, tests) means prod.
// Read at call time rather than module load so a build can be pointed at another origin.
function canonicalOrigin() {
  return (process.env.SITE_ORIGIN || PROD_ORIGIN).replace(/\/+$/, "");
}
// Partial templates are script assets, not user content — resolve them relative to this file
// (not the caller's sourceDir) so runBuild() works against any content directory, including
// a test fixture that has no scripts/templates/ of its own.
const templatesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "templates");

function ensureEmptyDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Non-production builds (the stage workflow sets SITE_ENV=stage and SITE_REF=<branch>) get a
// visible environment label: a badge in the top bar and a "[Stage]" prefix on the tab title.
// Unset SITE_ENV (prod, local, tests) means no label at all.
function siteEnvLabel() {
  const env = (process.env.SITE_ENV || "").trim().replace(/[^a-z0-9-]/gi, "");
  if (!env || env.toLowerCase() === "production") {
    return "";
  }
  return env.charAt(0).toUpperCase() + env.slice(1).toLowerCase();
}

function titlePrefix() {
  const label = siteEnvLabel();
  return label ? `[${label}] ` : "";
}

function envBadgeHtml() {
  const label = siteEnvLabel();
  if (!label) {
    return "";
  }
  const ref = (process.env.SITE_REF || "").trim();
  const refHtml = ref ? `<span class="env-badge-ref">${escapeHtml(ref)}</span>` : "";
  return `<span class="env-badge" title="${escapeHtml(ref ? `${label} build of branch ${ref}` : `${label} build`)}">${escapeHtml(label)}${refHtml}</span>`;
}

function appBarClass() {
  return siteEnvLabel() ? "app-bar is-env" : "app-bar";
}

// Lucide-style inline icons (24px grid, 2px stroke) — same visual language as the dashboard's Icon.jsx.
const ICON_PATHS = {
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  mapPin:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
};

function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
}

function parseUtcDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

// "16–19 Oct 2026", "12 Feb – 3 Mar 2026", "28 Dec 2026 – 2 Jan 2027".
export function formatDateRange(startDate, endDate) {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  const day = (date) => date.getUTCDate();
  const month = (date) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
  const year = (date) => date.getUTCFullYear();

  if (startDate === endDate) {
    return `${day(start)} ${month(start)} ${year(start)}`;
  }
  if (year(start) !== year(end)) {
    return `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`;
  }
  if (month(start) !== month(end)) {
    return `${day(start)} ${month(start)} – ${day(end)} ${month(end)} ${year(end)}`;
  }
  return `${day(start)}–${day(end)} ${month(end)} ${year(end)}`;
}

function formatShortRange(startDate, endDate) {
  return formatDateRange(startDate, endDate).replace(/ \d{4}/g, "");
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// The trip page's only <h1> is the hero title, so the markdown's top heading level must render
// as <h2>. Trip files differ: some use "#" for sections, others start at "##". Returns the pandoc
// --shift-heading-level-by value that maps the file's highest ATX heading to <h2> (1 for "#",
// 0 for "##", ...). Headings inside fenced code blocks and the YAML frontmatter are ignored.
export function headingShiftFor(markdown) {
  const body = String(markdown).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  let inFence = false;
  let topLevel = null;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const match = !inFence && /^(#{1,6})\s+\S/.exec(line);
    if (match && (topLevel === null || match[1].length < topLevel)) {
      topLevel = match[1].length;
    }
  }
  return topLevel === null ? 1 : 2 - topLevel;
}

function encodeSvgFavicon(icon) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#f4f7ff"/>
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-size="38">${escapeHtml(icon)}</text>
    </svg>
  `;

  return encodeURIComponent(svg.trim());
}

function buildOgImageSvg(trip) {
  // Plain "Arial, sans-serif" is used deliberately: resvg's font matcher needs a name it can
  // actually resolve via fontdb, and font stacks with CSS-only aliases (e.g. "-apple-system")
  // or unavailable web fonts (e.g. "Inter") fail to match and render nothing at all. Emoji
  // glyphs are skipped for the same reason — color-emoji fonts aren't reliably rasterizable
  // here (tested blank on macOS/Apple Color Emoji); the favicon <link> still shows the emoji
  // fine since browsers render that natively, without going through resvg.
  const title = escapeHtml(trip.title.replace(/\p{Extended_Pictographic}️?\s*/gu, "").trim());
  const subtitle = escapeHtml(`${trip.startDate} to ${trip.endDate}`);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#f4f7ff"/>
      <rect x="0" y="0" width="1200" height="14" fill="#2f63ff"/>
      <circle cx="150" cy="300" r="70" fill="#dbe5ff"/>
      <circle cx="150" cy="300" r="70" fill="none" stroke="#2f63ff" stroke-width="6"/>
      <text x="90" y="440" font-size="64" font-weight="700" font-family="Arial, sans-serif" fill="#18243b">${title}</text>
      <text x="90" y="495" font-size="32" font-family="Arial, sans-serif" fill="#5b6b85">${subtitle}</text>
    </svg>
  `;
}

function buildOgTags(trip, pageUrl) {
  const title = escapeHtml(trip.seoTitle);
  const description = escapeHtml(trip.description);
  const imageUrl = `${canonicalOrigin()}/og/${trip.slug}.png`;

  return `<meta property="og:type" content="website" />
<meta property="og:site_name" content="Travel Pages" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${imageUrl}" />`;
}

// Share cards are public (staticwebapp.config.json only exposes /share/* and /og/* to anonymous
// visitors), so they can't use the gated assets/ stylesheet or hero/ images: styles are inlined
// here and the photo comes from /og/. Token values mirror scripts/templates/trip-page.css.
const SHARE_CARD_CSS = `
    :root {
      color-scheme: light;
      --color-bg: #f8fafc; --color-surface: #ffffff; --color-surface-muted: #f1f5f9;
      --color-border: #dce4f0; --color-text: #0f172a; --color-text-muted: #475569;
      --color-primary: #1e40af; --color-primary-hover: #1e3a8a; --color-on-primary: #ffffff;
      --color-ring: #1e40af; --shadow-md: 0 4px 24px rgba(15, 23, 42, 0.08);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        color-scheme: dark;
        --color-bg: #0b1220; --color-surface: #111a2e; --color-surface-muted: #18233b;
        --color-border: #26324a; --color-text: #e2e8f0; --color-text-muted: #94a3b8;
        --color-primary: #60a5fa; --color-primary-hover: #93c5fd; --color-on-primary: #0b1220;
        --color-ring: #93c5fd; --shadow-md: 0 4px 24px rgba(0, 0, 0, 0.4);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; min-height: 100dvh;
      display: flex; align-items: center; justify-content: center;
      padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
      font-family: "Fira Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.55; background: var(--color-bg); color: var(--color-text);
      -webkit-font-smoothing: antialiased;
    }
    .share-card {
      width: 100%; max-width: 440px; overflow: hidden;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: 20px; box-shadow: var(--shadow-md);
    }
    .share-image { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; background: var(--color-surface-muted); }
    .share-emblem {
      display: flex; align-items: center; justify-content: center; aspect-ratio: 16 / 7;
      background: var(--color-surface-muted); font-size: 3.5rem; line-height: 1;
    }
    .share-body { padding: 24px; }
    .share-eyebrow { margin: 0 0 8px; color: var(--color-text-muted); font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 1.75rem; line-height: 1.2; letter-spacing: -0.02em; text-wrap: balance; }
    .share-meta { display: flex; align-items: flex-start; gap: 8px; margin: 8px 0 0; color: var(--color-text-muted); font-weight: 500; }
    .share-meta svg { flex: none; margin-top: 3px; }
    .share-description { margin: 16px 0 0; }
    .share-cta {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 48px; margin-top: 24px; padding: 0 20px; border-radius: 12px;
      background: var(--color-primary); color: var(--color-on-primary);
      font-weight: 600; text-decoration: none; touch-action: manipulation;
      transition: background-color 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .share-cta:hover { background: var(--color-primary-hover); }
    .share-cta:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 3px; }
    .share-note { margin: 12px 0 0; color: var(--color-text-muted); font-size: 0.8125rem; text-align: center; }
    @media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }
`;

function tripCities(trip) {
  return [...new Set(trip.places.map((place) => place.city))];
}

function tripCountries(trip) {
  return [...new Set(trip.places.map((place) => place.country))];
}

function buildShareCardHtml(trip, hasPhoto) {
  // <title> uses the longer SEO title (search/social surfaces); the visible <h1> keeps the
  // short display name — a human landing on this card doesn't need the keyword-stuffed version.
  const seoTitle = escapeHtml(trip.seoTitle);
  const displayTitle = escapeHtml(trip.title);
  const description = escapeHtml(trip.description);
  const faviconPayload = encodeSvgFavicon(trip.favicon);
  const pageUrl = `${canonicalOrigin()}/share/${trip.slug}.html`;
  const days = `${trip.vacationDays} day${trip.vacationDays === 1 ? "" : "s"}`;
  const places = trip.places.map((place) => `${place.city}, ${place.country}`).join(" · ");
  const media = hasPhoto
    ? `<img class="share-image" src="/og/${trip.slug}.webp" width="800" height="450" alt="" fetchpriority="high" />`
    : `<div class="share-emblem" aria-hidden="true">${escapeHtml(trip.favicon)}</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${seoTitle}</title>
  <meta name="description" content="${description}" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${faviconPayload}" />
  <meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&display=swap" />
  ${buildOgTags(trip, pageUrl)}
  <style>${SHARE_CARD_CSS}  </style>
</head>
<body>
  <main>
    <article class="share-card">
      ${media}
      <div class="share-body">
        <p class="share-eyebrow">Shared trip</p>
        <h1>${displayTitle}</h1>
        <p class="share-meta">${icon("calendar", 16)}<span>${escapeHtml(formatDateRange(trip.startDate, trip.endDate))} · ${days}</span></p>
        <p class="share-meta">${icon("mapPin", 16)}<span>${escapeHtml(places)}</span></p>
        <p class="share-description">${description}</p>
        <a class="share-cta" href="/${trip.slug}.html">Sign in to view this trip</a>
        <p class="share-note">These travel pages are private. Signing in uses GitHub.</p>
      </div>
    </article>
  </main>
</body>
</html>
`;
}

function renderTripCard(trip, hasHeroImage, index) {
  const { expenses } = trip;
  const media = hasHeroImage
    ? `<img src="hero/${trip.slug}-800.webp" width="800" height="450" alt=""${index === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" />`
    : `<span class="trip-card-emblem" aria-hidden="true">${escapeHtml(trip.favicon)}</span>`;
  const meta = [`${trip.vacationDays} day${trip.vacationDays === 1 ? "" : "s"}`];
  if (expenses.isTracked) {
    meta.push(`${formatMoney(expenses.total, expenses.baseCurrency)} booked`);
  }

  return `        <li>
          <a class="trip-card" href="${trip.path}">
            <span class="trip-card-media">${media}</span>
            <span class="trip-card-body">
              <span class="trip-status" data-trip-status data-start="${trip.startDate}" data-end="${trip.endDate}" hidden></span>
              <h3 class="trip-card-title">${escapeHtml(trip.title)}</h3>
              <span class="trip-card-line">${icon("calendar", 16)}<time datetime="${trip.startDate}">${escapeHtml(formatDateRange(trip.startDate, trip.endDate))}</time></span>
              <span class="trip-card-line">${icon("mapPin", 16)}<span>${escapeHtml(tripCities(trip).join(" · "))}</span></span>
              <span class="trip-card-meta">${escapeHtml(meta.join(" · "))}</span>
            </span>
          </a>
        </li>`;
}

// Trip index: grouped by year (newest first), newest trip first within a year.
function renderIndexHtml(trips, heroSlugs) {
  const sorted = trips.slice().sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const years = [...new Set(sorted.map((trip) => trip.year))];
  const totalDays = trips.reduce((sum, trip) => sum + trip.vacationDays, 0);
  const countryCount = new Set(trips.flatMap(tripCountries)).size;
  let cardIndex = 0;

  const yearSections = years
    .map((year) => {
      const cards = sorted
        .filter((trip) => trip.year === year)
        .map((trip) => renderTripCard(trip, heroSlugs.has(trip.slug), cardIndex++))
        .join("\n");
      return `    <section class="trip-year" aria-labelledby="year-${year}">
      <h2 id="year-${year}">${year}</h2>
      <ul class="trip-grid">
${cards}
      </ul>
    </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${titlePrefix()}Travel Pages</title>
  <meta name="description" content="Itineraries, dates and booked costs for ${trips.length} trip${trips.length === 1 ? "" : "s"} across ${years.length} year${years.length === 1 ? "" : "s"}." />
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#111a2e" media="(prefers-color-scheme: dark)" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=Fira+Sans:wght@400;500;600;700&display=swap" />
  <link rel="stylesheet" href="assets/trip-page.css" />
  <script src="assets/trip-status.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>
  <header class="${appBarClass()}">
    <div class="app-bar-inner">
      <span class="app-bar-start"><span class="app-bar-brand">Travel Pages</span>${envBadgeHtml()}</span>
      <div class="app-bar-actions">
        <a class="app-bar-action app-bar-action-labelled" href="dashboard/">${icon("chart")}<span>Dashboard</span></a>
      </div>
    </div>
  </header>
  <main id="content" class="trip-index" tabindex="-1">
    <div class="trip-index-intro">
      <h1>Trips</h1>
      <p>${trips.length} trip${trips.length === 1 ? "" : "s"} · ${totalDays} days · ${countryCount} countr${countryCount === 1 ? "y" : "ies"}</p>
    </div>
${yearSections}
  </main>
</body>
</html>
`;
}

export async function runBuild({ sourceDir, outputDir, skipPandoc = false }) {
  const ogImageDir = path.join(outputDir, "og");
  const shareCardDir = path.join(outputDir, "share");
  const heroImageDir = path.join(outputDir, "hero");
  const tripPageTemplate = path.join(templatesDir, "trip-page.html");
  const tripPageStylesheet = path.join(templatesDir, "trip-page.css");
  const tripStatusScript = path.join(templatesDir, "trip-status.js");
  const foodGalleryScript = path.join(templatesDir, "trip-food-gallery.js");
  const quickExpensePartial = path.join(templatesDir, "trip-page-quick-expense.html");
  const foodGalleryPartial = path.join(templatesDir, "trip-page-food-gallery.html");

  function renderOgImageCard(trip) {
    const svg = buildOgImageSvg(trip);
    const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
    return resvg.render().asPng();
  }

  async function fetchOgPhoto(trip) {
    const response = await fetch(trip.ogImage);
    if (!response.ok) {
      throw new Error(`fetch failed with status ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  // The same source photo also becomes the trip page's hero banner, as small WebP renditions
  // (the 1200x630 PNG share image is far too heavy to put above the fold on a phone).
  async function writeHeroImages(trip, sourceBuffer) {
    fs.mkdirSync(heroImageDir, { recursive: true });
    for (const width of [800, 1600]) {
      const webp = await sharp(sourceBuffer)
        .resize(width, Math.round((width * 9) / 16), { fit: "cover" })
        .webp({ quality: 72 })
        .toBuffer();
      fs.writeFileSync(path.join(heroImageDir, `${trip.slug}-${width}.webp`), webp);
      if (width === 800) {
        // Public copy for the share card — hero/ sits behind sign-in, og/ doesn't.
        fs.writeFileSync(path.join(ogImageDir, `${trip.slug}.webp`), webp);
      }
    }
  }

  // Returns true when a hero photo was written for the trip page.
  async function writeOgImage(trip) {
    fs.mkdirSync(ogImageDir, { recursive: true });
    const outputPath = path.join(ogImageDir, `${trip.slug}.png`);

    if (trip.ogImage) {
      try {
        const sourceBuffer = await fetchOgPhoto(trip);
        const png = await sharp(sourceBuffer).resize(1200, 630, { fit: "cover" }).png().toBuffer();
        fs.writeFileSync(outputPath, png);
        await writeHeroImages(trip, sourceBuffer);
        return true;
      } catch (error) {
        console.warn(
          `Could not use ogImage for ${trip.slug} (${trip.ogImage}): ${error.message}. Falling back to the generated card.`
        );
      }
    }

    fs.writeFileSync(outputPath, renderOgImageCard(trip));
    return false;
  }

  function buildHeadMetadataPartial(trip) {
    const faviconPayload = encodeSvgFavicon(trip.favicon);
    const pageUrl = `${canonicalOrigin()}/${trip.slug}.html`;

    // Pandoc already emits <title> (from the -M title override below, so it gets the longer
    // seoTitle rather than the frontmatter's short title) and <meta name="description"> (from
    // the frontmatter's description field directly) — adding either again here would duplicate
    // them. These tags are only ever seen by a logged-in viewer's own browser (the real page
    // stays gated, so crawlers can't reach it) — see buildShareCardHtml() for the public preview.
    const html = `
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${faviconPayload}" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#111a2e" media="(prefers-color-scheme: dark)" />
${buildOgTags(trip, pageUrl)}
`;

    const partialPath = path.join(outputDir, `.head-meta-${trip.slug}.html`);
    fs.writeFileSync(partialPath, html);
    return partialPath;
  }

  function buildTripHeroHtml(trip, hasHeroImage) {
    const title = escapeHtml(trip.title);
    const { expenses } = trip;
    const places = trip.places
      .map(
        (place) =>
          `<li>${icon("mapPin", 16)}<span>${escapeHtml(place.city)}, ${escapeHtml(place.country)}</span><span class="trip-place-dates">${escapeHtml(formatShortRange(place.startDate, place.endDate))}</span></li>`
      )
      .join("\n          ");

    const facts = [
      { label: "Days", value: String(trip.vacationDays) },
      { label: trip.places.length === 1 ? "Place" : "Places", value: String(trip.places.length) }
    ];
    if (expenses.isTracked) {
      facts.push({ label: "Booked", value: formatMoney(expenses.total, expenses.baseCurrency) });
      facts.push({
        label: `Per person (${expenses.partySize})`,
        value: formatMoney(expenses.totalPerPerson, expenses.baseCurrency)
      });
    }
    const factItems = facts
      .map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`)
      .join("\n          ");

    const media = hasHeroImage
      ? `<img class="trip-hero-image" src="hero/${trip.slug}-1600.webp" srcset="hero/${trip.slug}-800.webp 800w, hero/${trip.slug}-1600.webp 1600w" sizes="100vw" width="1600" height="900" alt="" fetchpriority="high" />`
      : `<span class="trip-hero-emblem" aria-hidden="true">${escapeHtml(trip.favicon)}</span>`;

    return `<header class="${appBarClass()}">
    <div class="app-bar-inner">
      <span class="app-bar-start"><a class="back-link" href="index.html">${icon("arrowLeft")}<span>All trips</span></a>${envBadgeHtml()}</span>
      <div class="app-bar-actions">
        <a class="app-bar-action" href="dashboard/">${icon("chart")}<span>Dashboard</span></a>
        <a class="app-bar-action" href="/share/${trip.slug}.html" data-trip-share data-title="${title}">${icon("share")}<span>Share</span></a>
      </div>
    </div>
  </header>
  <section class="trip-hero ${hasHeroImage ? "has-image" : "no-image"}" aria-labelledby="trip-title">
    <div class="trip-hero-cover">
      ${media}
      <div class="trip-hero-cover-inner">
        <p class="trip-status" data-trip-status data-start="${trip.startDate}" data-end="${trip.endDate}" hidden></p>
        <h1 id="trip-title">${title}</h1>
        <p class="trip-dates">${icon("calendar")}<time datetime="${trip.startDate}">${escapeHtml(formatDateRange(trip.startDate, trip.endDate))}</time><span aria-hidden="true">·</span><span>${trip.vacationDays} day${trip.vacationDays === 1 ? "" : "s"}</span></p>
      </div>
    </div>
    <div class="trip-hero-body">
      <p class="trip-description">${escapeHtml(trip.description)}</p>
      <ul class="trip-places" aria-label="Places">
          ${places}
      </ul>
      <dl class="trip-facts">
          ${factItems}
      </dl>
    </div>
  </section>
  <section class="trip-actions" aria-label="Log an expense">
    ${fs.readFileSync(quickExpensePartial, "utf-8").trim()}
  </section>
`;
  }

  function buildTripHeroPartial(trip, hasHeroImage) {
    const partialPath = path.join(outputDir, `.hero-${trip.slug}.html`);
    fs.writeFileSync(partialPath, buildTripHeroHtml(trip, hasHeroImage));
    return partialPath;
  }

  function writeShareCard(trip, hasPhoto) {
    fs.mkdirSync(shareCardDir, { recursive: true });
    fs.writeFileSync(path.join(shareCardDir, `${trip.slug}.html`), buildShareCardHtml(trip, hasPhoto));
  }

  function convertMarkdownToHtml(mdFile, trip, hasHeroImage) {
    const outputFile = path.join(outputDir, `${trip.slug}.html`);
    const headMetadataPartial = buildHeadMetadataPartial(trip);
    const heroPartial = buildTripHeroPartial(trip, hasHeroImage);
    const result = spawnSync(
      "pandoc",
      [
        mdFile,
        "-f",
        "markdown",
        "-t",
        "html",
        "-s",
        "--template",
        tripPageTemplate,
        "-M",
        `title=${trip.seoTitle}`,
        "-V",
        `title-prefix=${titlePrefix()}`,
        // The page's <h1> is the hero title: shift so the file's top heading level becomes <h2>.
        `--shift-heading-level-by=${headingShiftFor(fs.readFileSync(mdFile, "utf-8"))}`,
        "--toc",
        // Depth 4 counts <h2>–<h4> after the shift, so deeper itineraries (e.g. Valencia's
        // per-day sections) are listed as well as the top-level sections.
        "--toc-depth=4",
        "-H",
        headMetadataPartial,
        "-B",
        heroPartial,
        "-A",
        foodGalleryPartial,
        "-o",
        outputFile
      ],
      { stdio: "inherit" }
    );

    fs.rmSync(headMetadataPartial, { force: true });
    fs.rmSync(heroPartial, { force: true });

    if (result.status !== 0) {
      throw new Error(`pandoc failed for ${mdFile}`);
    }
  }

  // Returns the slugs that got a hero photo.
  async function buildTripPages(tripEntries) {
    const heroSlugs = new Set();
    if (skipPandoc) {
      return heroSlugs;
    }

    for (const { fileName, trip } of tripEntries) {
      const hasHeroImage = await writeOgImage(trip);
      if (hasHeroImage) {
        heroSlugs.add(trip.slug);
      }
      writeShareCard(trip, hasHeroImage);
      convertMarkdownToHtml(path.join(sourceDir, fileName), trip, hasHeroImage);
    }
    return heroSlugs;
  }

  // Shared by the trip pages and the index (the index is written even with --skip-pandoc).
  function copySharedAssets() {
    const assetsDir = path.join(outputDir, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.copyFileSync(tripPageStylesheet, path.join(assetsDir, "trip-page.css"));
    fs.copyFileSync(tripStatusScript, path.join(assetsDir, "trip-status.js"));
    fs.copyFileSync(foodGalleryScript, path.join(assetsDir, "trip-food-gallery.js"));
  }

  function copyStaticConfig() {
    const configPath = path.join(sourceDir, "staticwebapp.config.json");
    if (!fs.existsSync(configPath)) {
      return;
    }
    fs.copyFileSync(configPath, path.join(outputDir, "staticwebapp.config.json"));
  }

  ensureEmptyDir(outputDir);

  const tripEntries = loadTripEntries(sourceDir);
  copySharedAssets();
  const heroSlugs = await buildTripPages(tripEntries);

  const trips = tripEntries.map(({ trip }) => trip);
  const dashboardData = buildDashboardData(trips);

  fs.writeFileSync(path.join(outputDir, "dashboard-data.json"), `${JSON.stringify(dashboardData, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "index.html"), renderIndexHtml(trips, heroSlugs));

  copyStaticConfig();

  if (skipPandoc) {
    console.log(`Built dashboard data in ${outputDir} (trip HTML conversion skipped).`);
    return;
  }

  console.log(`Built ${trips.length} trips and dashboard data in ${outputDir}`);
}

async function main() {
  const sourceDir = process.cwd();
  const outputDir = path.join(sourceDir, "site");
  const skipPandoc = process.argv.includes("--skip-pandoc");
  await runBuild({ sourceDir, outputDir, skipPandoc });
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
