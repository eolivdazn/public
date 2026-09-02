# Public Pages Links

## Azure Static Web App

- Home: [https://white-stone-0b0565103.5.azurestaticapps.net/](https://white-stone-0b0565103.5.azurestaticapps.net/)
- Dashboard: [https://white-stone-0b0565103.5.azurestaticapps.net/dashboard/](https://white-stone-0b0565103.5.azurestaticapps.net/dashboard/)
- Thailand: [https://white-stone-0b0565103.5.azurestaticapps.net/thailand2026.html](https://white-stone-0b0565103.5.azurestaticapps.net/thailand2026.html)
- El Gouna: [https://white-stone-0b0565103.5.azurestaticapps.net/el-gouna2027.html](https://white-stone-0b0565103.5.azurestaticapps.net/el-gouna2027.html)
- Algarve: [https://white-stone-0b0565103.5.azurestaticapps.net/algarve2026.html](https://white-stone-0b0565103.5.azurestaticapps.net/algarve2026.html)

## Actions Workflow

- Deploy workflow: [Azure Static Web Apps CI/CD](https://github.com/eolivdazn/public/actions/workflows/azure-static-web-apps-white-stone-0b0565103.yml)

## Local Build

- Install: `npm ci`
- Tests: `npm test`
- Build trip pages + dashboard data (requires `pandoc`): `npm run build:site`
- Build dashboard data only (no `pandoc`): `npm run build:site -- --skip-pandoc`
- Build React dashboard: `npm run build:dashboard`
- Full build: `npm run build`

## Expenses API (Cosmos DB)

`api/` is an Azure Functions app (managed by Static Web Apps) backed by an Azure Cosmos DB
account, exposing `GET /api/expenses/{tripSlug?}` and `POST /api/expenses`.

- Local dev: `cd api && npm install && cp local.settings.json.example local.settings.json`,
  fill in `COSMOS_CONNECTION_STRING`, then `npm start` (requires Azure Functions Core Tools).
- Cosmos DB setup: create a database (`COSMOS_DATABASE_ID`, default `travel-dashboard`) and a
  container (`COSMOS_CONTAINER_ID`, default `expenses`) with partition key `/tripSlug`.
- Deployed app settings: set `COSMOS_CONNECTION_STRING`, `COSMOS_DATABASE_ID`, and
  `COSMOS_CONTAINER_ID` on the Static Web App itself, e.g.:
  `az staticwebapp appsettings set --name <swa-name> --setting-names COSMOS_CONNECTION_STRING="<value>" COSMOS_DATABASE_ID=travel-dashboard COSMOS_CONTAINER_ID=expenses`
- `staticwebapp.config.json` already gates `/*` (which includes `/api/*`) behind GitHub login,
  so the Functions endpoints don't need their own auth check.

