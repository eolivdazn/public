import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Resvg } from "@resvg/resvg-js";
import { buildDashboardData, computeTripLinks, loadTripEntries } from "./lib/travel-data.mjs";

const sourceDir = process.cwd();
const outputDir = path.join(sourceDir, "site");
const ogImageDir = path.join(outputDir, "og");
const skipPandoc = process.argv.includes("--skip-pandoc");
const backLinkPartial = path.join(sourceDir, "scripts", "templates", "trip-page-back-link.html");
const quickExpensePartial = path.join(sourceDir, "scripts", "templates", "trip-page-quick-expense.html");
const foodGalleryPartial = path.join(sourceDir, "scripts", "templates", "trip-page-food-gallery.html");
const canonicalOrigin = "https://white-stone-0b0565103.5.azurestaticapps.net";

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

function writeOgImage(trip) {
  const svg = buildOgImageSvg(trip);
  const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
  const png = resvg.render().asPng();
  fs.mkdirSync(ogImageDir, { recursive: true });
  fs.writeFileSync(path.join(ogImageDir, `${trip.slug}.png`), png);
}

function buildHeadMetadataPartial(trip) {
  const title = escapeHtml(trip.title);
  const description = escapeHtml(trip.description);
  const pageUrl = `${canonicalOrigin}/${trip.slug}.html`;
  const imageUrl = `${canonicalOrigin}/og/${trip.slug}.png`;
  const faviconPayload = encodeSvgFavicon(trip.favicon);

  // Pandoc already emits <title> and <meta name="description"> natively from the
  // frontmatter's title/description fields — adding them again here would duplicate them.
  const html = `
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${faviconPayload}" />
<meta name="theme-color" content="#2f63ff" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${imageUrl}" />
`;

  const partialPath = path.join(outputDir, `.head-meta-${trip.slug}.html`);
  fs.writeFileSync(partialPath, html);
  return partialPath;
}

function convertMarkdownToHtml(mdFile, trip) {
  const outputFile = path.join(outputDir, `${trip.slug}.html`);
  writeOgImage(trip);
  const headMetadataPartial = buildHeadMetadataPartial(trip);
  const result = spawnSync(
    "pandoc",
    [
      mdFile,
      "-f",
      "markdown",
      "-t",
      "html",
      "-s",
      "-B",
      headMetadataPartial,
      "-B",
      backLinkPartial,
      "-B",
      quickExpensePartial,
      "-A",
      foodGalleryPartial,
      "-o",
      outputFile
    ],
    { stdio: "inherit" }
  );

  fs.rmSync(headMetadataPartial, { force: true });

  if (result.status !== 0) {
    throw new Error(`pandoc failed for ${mdFile}`);
  }
}

function buildTripPages(tripEntries) {
  if (skipPandoc) {
    return;
  }

  for (const { fileName, trip } of tripEntries) {
    convertMarkdownToHtml(fileName, trip);
  }
}

function renderIndexHtml(links) {
  const listItems = links
    .map(
      (link) =>
        `      <li><a href="${link.path}">${link.title}</a><span class="meta">${link.dates}</span></li>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Travel Pages</title>
  <style>
    body { margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f8fc; color: #18243b; }
    main { max-width: 920px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #fff; border: 1px solid #dbe3f0; border-radius: 16px; padding: 24px; }
    h1 { margin-top: 0; }
    ul { padding-left: 20px; }
    li { margin-bottom: 12px; }
    a { color: #2f63ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { margin-left: 8px; color: #5b6b85; font-size: 0.93rem; }
    .dashboard-link { display: inline-block; margin-bottom: 20px; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>Travel Pages</h1>
      <a class="dashboard-link" href="dashboard/">Open dashboard</a>
      <ul>
${listItems}
      </ul>
    </div>
  </main>
</body>
</html>
`;
}

function copyStaticConfig(trips) {
  const configPath = path.join(sourceDir, "staticwebapp.config.json");
  if (!fs.existsSync(configPath)) {
    return;
  }

  // Trip pages need to be fetchable without login for link-preview crawlers (and anyone with
  // the direct link) to read their Open Graph tags — otherwise they hit the site-wide auth
  // gate and see a GitHub login redirect instead of the trip's title/description/image.
  // Generated here (not hand-maintained in the JSON) so a new trip is public automatically.
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const tripRoutes = trips.map((trip) => ({ route: `/${trip.slug}.html`, allowedRoles: ["anonymous"] }));
  config.routes = [...tripRoutes, ...(config.routes || [])];

  fs.writeFileSync(path.join(outputDir, "staticwebapp.config.json"), `${JSON.stringify(config, null, 2)}\n`);
}

function main() {
  ensureEmptyDir(outputDir);

  const tripEntries = loadTripEntries(sourceDir);
  buildTripPages(tripEntries);

  const trips = tripEntries.map(({ trip }) => trip);
  const dashboardData = buildDashboardData(trips);
  const links = computeTripLinks(trips);

  fs.writeFileSync(path.join(outputDir, "dashboard-data.json"), `${JSON.stringify(dashboardData, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "index.html"), renderIndexHtml(links));

  copyStaticConfig(trips);

  if (skipPandoc) {
    console.log(`Built dashboard data in ${outputDir} (trip HTML conversion skipped).`);
    return;
  }

  console.log(`Built ${trips.length} trips and dashboard data in ${outputDir}`);
}

main();
