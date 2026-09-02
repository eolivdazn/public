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

## API

The Azure Static Web Apps API lives under `api/` and exposes:

- `GET /api/expenses`
- `POST /api/expenses`

Expenses are persisted in Azure Cosmos DB (NoSQL API). The function requires:

- `COSMOS_DB_CONNECTION_STRING` (required)
- `COSMOS_DB_DATABASE_NAME` (optional, default `travel-dashboard`)
- `COSMOS_DB_CONTAINER_NAME` (optional, default `expenses`)

Locally, set these in an untracked `api/local.settings.json` (used by
`func start` / `swa start`). On the deployed Static Web App, add them under
**Configuration → Application settings** in the Azure Portal.

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

