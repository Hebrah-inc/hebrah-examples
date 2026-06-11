# hebrah examples

Reference integration demos for the hebrah sandbox control plane. Each demo is a self-contained app in its own subdirectory with its own `package.json`.

## Demos

| Demo | Path | Port | Description |
|------|------|------|-------------|
| Patient management | [`patient-demo/`](patient-demo/) | **3001** | Next.js app — FHIR patient list/detail, webhook receiver, mock event triggers |
| Admit monitor | [`admit-monitor-demo/`](admit-monitor-demo/) | **3002** | Next.js app — ADT census from webhooks, events via hebrah hosted MCP |

Future demos use ports **3003**, **3004**, etc.

## Prerequisites

1. hebrah platform running ([documentation/local-development.md](../documentation/local-development.md))
2. Sandbox credentials from hebrah-app onboarding (`hb_test_*`, `hbsec_*`)
3. For admit-monitor: universal PAT (`hb_pat_*`) from hebrah-app **Settings → MCP**

See also [documentation/agent-quickstart.md](../documentation/agent-quickstart.md) for a 15-minute end-to-end setup.

## Git

This directory is its own git repository. Run `git` commands here, not at the hebrah umbrella root.

## Adding a demo

1. Create a sibling folder (e.g. `live-sidecar-demo/`)
2. Add a row to the table above
3. Assign the next port in sequence
4. Root [`.gitignore`](.gitignore) globs cover Node/Next artifacts for all demos

## Local integration (patient-demo)

1. Start hebrah-api and hebrah-app ([documentation/local-development.md](../documentation/local-development.md))
2. Complete hebrah onboarding; copy `hb_test_*` and `hbsec_*` from Step 2
3. `cd patient-demo && cp .env.example .env` — fill in credentials
4. `pnpm install && pnpm dev` (runs on port **3001**)
5. Set **hebrah Settings → Webhook URL** to:
   - Docker hebrah-api: `http://host.docker.internal:3001/api/webhooks/hebrah`
   - Host hebrah-api: `http://localhost:3001/api/webhooks/hebrah`
6. Open **Events** in the demo → trigger a mock event → verify inbound webhook in the inbox

## Local integration (admit-monitor-demo)

1. Start hebrah-api, hebrah-app, and **hebrah-mcp-host** ([documentation/local-development.md](../documentation/local-development.md))
2. Complete hebrah onboarding; copy `hb_test_*`, `hbsec_*`, and connection ID
3. Generate `hb_pat_*` in hebrah-app **Settings → MCP**
4. Set `HEBRAH_SANDBOX_API_KEY=hb_test_...` on **hebrah-mcp-host** `.env`
5. `cd admit-monitor-demo && cp .env.example .env` — fill in `hbsec_*`, `hb_pat_*`, `HEBRAH_CONNECTION_ID`
6. `pnpm install && pnpm dev` (runs on port **3002**)
7. Register webhook URL in **hebrah Settings → Webhook URL**:
   - Docker hebrah-api: `http://host.docker.internal:3002/api/webhooks/hebrah`
   - Host hebrah-api: `http://localhost:3002/api/webhooks/hebrah`
8. Copy `.cursor/mcp.json` sample and set your `hb_pat_*` token
9. Agent workflow: `set_active_connection` → `trigger_test_webhook` with `patient.admitted` / `patient.discharged`
10. Watch **Census** at http://localhost:3002/census

See [admit-monitor-demo/README.md](admit-monitor-demo/README.md) for full runbook.
