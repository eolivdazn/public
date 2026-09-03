# Public Pages Links

## Azure Static Web App

- Home: [https://white-stone-0b0565103.5.azurestaticapps.net/](https://white-stone-0b0565103.5.azurestaticapps.net/)
- Dashboard: [https://white-stone-0b0565103.5.azurestaticapps.net/dashboard/](https://white-stone-0b0565103.5.azurestaticapps.net/dashboard/)
- Thailand: [https://white-stone-0b0565103.5.azurestaticapps.net/thailand2026.html](https://white-stone-0b0565103.5.azurestaticapps.net/thailand2026.html)
- El Gouna: [https://white-stone-0b0565103.5.azurestaticapps.net/el-gouna2027.html](https://white-stone-0b0565103.5.azurestaticapps.net/el-gouna2027.html)
- Algarve: [https://white-stone-0b0565103.5.azurestaticapps.net/algarve2026.html](https://white-stone-0b0565103.5.azurestaticapps.net/algarve2026.html)
- Valencia: [https://white-stone-0b0565103.5.azurestaticapps.net/valencia2026.html](https://white-stone-0b0565103.5.azurestaticapps.net/valencia2026.html)

## Actions Workflow

- Deploy workflow: [Azure Static Web Apps CI/CD](https://github.com/eolivdazn/public/actions/workflows/azure-static-web-apps-white-stone-0b0565103.yml)

## Architecture

```
Markdown trip files (*.md, YAML frontmatter validated against travel.schema.json)
        │  scripts/build-site.mjs (+ scripts/lib/travel-data.mjs, pandoc)
        ▼
   site/  ── static HTML trip pages
        │      + dashboard-data.json  (pre-computed static totals/years/trips)
        │
   dashboard/ (React + Vite) ── built into site/dashboard/
        ▼
  Browser loads site/dashboard/, fetches dashboard-data.json (static)
  and GET /api/expenses (live) in parallel, merges both client-side
        │
        ▼
   api/expenses  (Azure Function, Node.js, GET/POST/DELETE)
        │  api/lib/expense-store.js (@azure/cosmos SDK)
        ▼
   Azure Cosmos DB (NoSQL API)
   database "travel-dashboard" → container "expenses", partition key /tripSlug
```

**Static site generation.** Each trip is a Markdown file at the repo root with
YAML frontmatter (`slug`, `year`, dates, places, `expenses.categories`,
`expenses.partySize`, etc.), validated and parsed by
`scripts/lib/travel-data.mjs`. `slug` and `year` are explicit frontmatter
fields, not derived from the filename — `slug` (lowercase letters, digits and
hyphens) is the trip's canonical id, used for the generated `<slug>.html`
filename and as `tripSlug` in the expenses API; `year` is the trip's primary
year and must fall within `startDate`'s/`endDate`'s year. Duplicate slugs
across files are rejected. Running `npm run build:site`
(`scripts/build-site.mjs`) converts each trip's body to HTML via `pandoc`
(skippable with `--skip-pandoc`) and aggregates all trips into
`site/dashboard-data.json` — per-year buckets (a trip spanning New Year's has
its expenses split proportionally across years), an overall `summary`, and
the full `trips` list. It also copies `staticwebapp.config.json` into `site/`
so it deploys alongside the static content.

**Dashboard (React SPA).** `dashboard/src/App.jsx` is the entire UI, built by
Vite into `site/dashboard/`. On load it fetches the static
`dashboard-data.json` and, separately, *all* live entries from
`GET /api/expenses` (no `tripSlug` filter). The two are merged client-side —
each live entry is attributed to a year (from its own `date`) and a trip
(`tripSlug`) and folded into that year/trip's static totals (see
`combineTripYearSlice` / `summarizeYearTrips` / `filterYearItemByTrip` in
`App.jsx`) — so every total shown (year cards, per-trip breakdown, overall
summary) reflects markdown-defined baseline costs *plus* whatever's been
logged live, without a full site rebuild. The UI has two views, toggled
client-side (no router): **Finance** (trip-filterable; add/view/remove live
expenses; financial totals) and **Summary by year** (year + trip filterable;
cities/countries/trips-per-year breakdown).

**API (Azure Function).** `api/expenses` is a single HTTP-triggered Function
(`api/expenses/function.json` + `index.js`) handling `GET`/`POST`/`DELETE` on
`/api/expenses`. `api/lib/expense-store.js` wraps the Cosmos DB SDK
(`@azure/cosmos`): each expense is one document, partitioned by `tripSlug`,
id'd by its own `id`. The database/container are created automatically on
first use. The Function binding itself uses `authLevel: anonymous` — access
control is actually enforced one layer up, by `staticwebapp.config.json`'s
`allowedRoles: ["approved"]` on every route (including `/api/*`), which Azure
evaluates before a request reaches the Function at all.

**Deployment.** The GitHub Actions workflow
(`.github/workflows/azure-static-web-apps-white-stone-0b0565103.yml`, runs on
push to `main` and on PRs) builds the site itself (`npm run build:site` +
`npm run build:dashboard`, `skip_app_build: true` since it's pre-built), and
hands `api/` to `Azure/static-web-apps-deploy@v1`, which builds it via Oryx
(installing `api/`'s own dependencies) and deploys everything to one Azure
Static Web App.

**Infra.**

| Resource | Name | Tier |
|---|---|---|
| Static Web App | `swa-public-pages` (`rg-public-pages`, West Europe) | Free |
| Cosmos DB | `travel-eo-cosmos` (`rg-public-pages`, West Europe) | Free tier (1000 RU/s + 25GB included) |

Auth is GitHub OAuth via Static Web Apps' built-in auth — unauthenticated or
unapproved users are redirected to `/.auth/login/github` per
`staticwebapp.config.json`.

## Running locally

### Prerequisites

- Node.js 20+
- `pandoc` — optional, only needed to regenerate trip HTML pages; dashboard
  data can be built without it (`--skip-pandoc`)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) — to run `api/` locally:
  `brew tap azure/functions && brew install azure-functions-core-tools@4`
- [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) — to run the site + API together like production:
  `npm install -g @azure/static-web-apps-cli`

### Build

- Install dependencies: `npm ci` (root) and `cd api && npm ci` (API)
- Build trip pages + dashboard data (requires `pandoc`): `npm run build:site`
- Build dashboard data only (no `pandoc`): `npm run build:site -- --skip-pandoc`
- Build React dashboard: `npm run build:dashboard`
- Full build: `npm run build`

### Run the site + API together (recommended)

This is the closest match to production: it serves the built static site and
proxies `/api/*` to a local Functions host, enforcing the same
`staticwebapp.config.json` auth rules as the real deployment.

1. Create `api/local.settings.json` (gitignored) with the Cosmos DB settings
   — see [API](#api) below.
2. Build: `npm run build:site -- --skip-pandoc && npm run build:dashboard`
3. Start: `swa start site --api-location api`
4. Open `http://localhost:4280/dashboard/`.

Every route requires the `approved` role, so you'll be redirected to
`/.auth/login/github`. The SWA CLI shows a **mock** login form (not real
GitHub) — enter any username, add `approved` in the roles field, submit. To
skip that form on later visits, run this once in the browser console instead
(it sets the same cookie the form would):

```js
document.cookie = "StaticWebAppsAuthCookie=" + btoa(JSON.stringify({
  identityProvider: "github", userId: "local-dev", userDetails: "local-dev",
  userRoles: ["approved", "anonymous", "authenticated"], claims: []
})) + "; path=/";
location.href = "/dashboard/";
```

### Run the API alone (faster, no auth)

Useful for quickly testing `/api/expenses` without the site or auth
emulation:

```bash
cd api && func start   # http://localhost:7071
```

```bash
curl -X POST http://localhost:7071/api/expenses -H 'Content-Type: application/json' \
  -d '{"tripSlug":"algarve2026","category":"food","amount":42.5,"currency":"EUR","date":"2026-09-14","description":"Dinner"}'

curl http://localhost:7071/api/expenses?tripSlug=algarve2026

curl -X DELETE "http://localhost:7071/api/expenses?id=<id>&tripSlug=algarve2026"
```

`vite dev` / `vite preview` (`npm run dev:dashboard` / `preview:dashboard`)
only serve the static dashboard bundle — there's no `/api/*` backend behind
them, so expense requests will fail there. Use `swa start` for anything that
touches the API.

### Tests

- `npm test` — build script / Markdown parsing tests
- `cd api && npm test` — expense store tests, run against an in-memory fake
  container (no real Cosmos DB needed)

## API

The Azure Static Web Apps API lives under `api/` and exposes:

- `GET /api/expenses` — list expenses, optionally filtered with `?tripSlug=...`
- `POST /api/expenses` — create an expense
- `DELETE /api/expenses?id=...&tripSlug=...` — remove an expense

Expenses are persisted in Azure Cosmos DB (NoSQL API). The function requires:

- `COSMOS_DB_CONNECTION_STRING` (required)
- `COSMOS_DB_DATABASE_NAME` (optional, default `travel-dashboard`)
- `COSMOS_DB_CONTAINER_NAME` (optional, default `expenses`)
- `COSMOS_EXPENSE_AUDIT_CONTAINER_NAME` (optional, default `expense-audit`)

Locally, set these in an untracked `api/local.settings.json` (used by
`func start` / `swa start`). On the deployed Static Web App, add them under
**Configuration → Application settings** in the Azure Portal.

**Who created/deleted an expense.** Every route is already gated behind
`allowedRoles: ["approved"]` in `staticwebapp.config.json`, so by the time a
request reaches `api/expenses` it has already been authenticated by the SWA
auth layer, which injects an `x-ms-client-principal` header (base64 JSON with
`userId`/`userDetails`/`identityProvider`/`userRoles`) into the request.
`api/lib/client-principal.js` decodes it; `api/expenses/index.js` reads it
once per request and passes it down as `actor`. On `POST`, the actor is
stored as `createdBy: { userId, userDetails }` on the expense document
itself (shown as "added by ..." in the dashboard). On `DELETE`, since Cosmos
removes the document, there's nothing left to attach `createdBy` to — instead
both create and delete actions are recorded in a second Cosmos container,
`expense-audit` (partition key `/tripSlug`, one document per action:
`{ action, expenseId, tripSlug, actor, at }`; there's no API endpoint to read
it yet, so inspect it via Cosmos Data Explorer in the Portal). Recording an
audit entry is best-effort — a failure there logs a warning but doesn't fail
the request, since the expense itself was already created/deleted.
Running `cd api && func start` alone (no `swa start` in front) means no auth
layer injects the header, so `actor` will be `null` and `createdBy` stays
`null` in that mode.

Example request:

```bash
curl -X POST http://localhost:4280/api/expenses \
  -H 'Content-Type: application/json' \
  -d '{
	"tripSlug": "algarve2026",
	"category": "food",
	"amount": 42.5,
	"currency": "EUR",
	"date": "2026-09-14",
	"description": "Dinner"
  }'
```
