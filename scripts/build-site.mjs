import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";
import { buildDashboardData, computeTripLinks, loadTripEntries } from "./lib/travel-data.mjs";

const sourceDir = process.cwd();
const outputDir = path.join(sourceDir, "site");
const skipPandoc = process.argv.includes("--skip-pandoc");
const backLinkPartial = path.join(sourceDir, "scripts", "templates", "trip-page-back-link.html");
const quickExpensePartial = path.join(sourceDir, "scripts", "templates", "trip-page-quick-expense.html");
const foodGalleryPartial = path.join(sourceDir, "scripts", "templates", "trip-page-food-gallery.html");

function ensureEmptyDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function encodeSvgFavicon(icon) {
  const safe = String(icon || "✈️")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#f4f7ff"/>
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-size="38">${safe}</text>
    </svg>
  `;

  return encodeURIComponent(svg.trim());
}

function readTripMeta(mdFile) {
  const raw = fs.readFileSync(mdFile, "utf-8");
  const { data } = matter(raw);
  return data;
}

function createFaviconPartial(mdFile, slug) {
  const data = readTripMeta(mdFile);
  const icon = typeof data.favicon === "string" && data.favicon.trim() ? data.favicon.trim() : "✈️";
  const payload = encodeSvgFavicon(icon);

  const partialPath = path.join(outputDir, `.favicon-${slug}.html`);
  fs.writeFileSync(
    partialPath,
    `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${payload}" />\n<meta name="theme-color" content="#2f63ff" />\n`
  );
  return partialPath;
}

function buildMetadataPartial(mdFile, slug) {
  const data = readTripMeta(mdFile);
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug;
  const description = typeof data.description === "string" && data.description.trim() ? data.description.trim() : `Travel notes and plans for ${title}.`;
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const safeDescription = description
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const partialPath = path.join(outputDir, `.meta-${slug}.html`);
  fs.writeFileSync(
    partialPath,
    `<title>${safeTitle}</title>\n<meta name="description" content="${safeDescription}" />\n`
  );
  return partialPath;
}

function convertMarkdownToHtml(mdFile, slug) {
  const outputFile = path.join(outputDir, `${slug}.html`);
  const faviconPartial = createFaviconPartial(mdFile, slug);
  const metadataPartial = buildMetadataPartial(mdFile, slug);
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
      metadataPartial,
      "-B",
      faviconPartial,
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

  fs.rmSync(faviconPartial, { force: true });
  fs.rmSync(metadataPartial, { force: true });

  if (result.status !== 0) {
    throw new Error(`pandoc failed for ${mdFile}`);
  }
}

function buildTripPages(tripEntries) {
  if (skipPandoc) {
    return;
  }

  for (const { fileName, trip } of tripEntries) {
    convertMarkdownToHtml(fileName, trip.slug);
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
  <meta name="description" content="Travel plans, trip notes, and city guides from recent journeys." />
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

function copyStaticConfig() {
  const configPath = path.join(sourceDir, "staticwebapp.config.json");
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, path.join(outputDir, "staticwebapp.config.json"));
  }
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

  copyStaticConfig();

  if (skipPandoc) {
    console.log(`Built dashboard data in ${outputDir} (trip HTML conversion skipped).`);
    return;
  }

  console.log(`Built ${trips.length} trips and dashboard data in ${outputDir}`);
}

main();
