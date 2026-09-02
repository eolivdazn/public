import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildDashboardData, computeTripLinks, loadTrips } from "./lib/travel-data.mjs";

const sourceDir = process.cwd();
const outputDir = path.join(sourceDir, "site");
const skipPandoc = process.argv.includes("--skip-pandoc");

function ensureEmptyDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function convertMarkdownToHtml(mdFile) {
  const outputFile = path.join(outputDir, `${path.basename(mdFile, ".md")}.html`);
  const result = spawnSync(
    "pandoc",
    [mdFile, "-f", "markdown", "-t", "html", "-s", "-o", outputFile],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    throw new Error(`pandoc failed for ${mdFile}`);
  }
}

function buildTripPages() {
  if (skipPandoc) {
    return;
  }

  const markdownFiles = fs
    .readdirSync(sourceDir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort();

  if (markdownFiles.length === 0) {
    throw new Error("No markdown files found at repo root (excluding README.md).");
  }

  for (const fileName of markdownFiles) {
    convertMarkdownToHtml(fileName);
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

function copyStaticConfig() {
  const configPath = path.join(sourceDir, "staticwebapp.config.json");
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, path.join(outputDir, "staticwebapp.config.json"));
  }
}

function main() {
  ensureEmptyDir(outputDir);
  buildTripPages();

  const trips = loadTrips(sourceDir);
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


