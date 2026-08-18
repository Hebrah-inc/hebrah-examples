# admit-monitor-demo

Reference Next.js app for **hebrah hosted MCP** + **signed webhooks**: maintain an admit/discharge census from `patient.admitted` and `patient.discharged` events.

Runs on port **3002** (see [hebrah-examples/README.md](../README.md)).

## Prerequisites

1. hebrah-api + hebrah-app + **[hebrah-mcp-host](https://github.com/Hebrah-inc/hebrah-mcp-host)** running locally. See the umbrella repo's [local development guide](https://github.com/Hebrah-inc/hebrah/blob/main/documentation/local-development.md).
2. Hebrah onboarding credentials — request access at [hebrah.com/request-demo](https://hebrah.com/request-demo) and copy `hb_test_*` (API key) and `hbsec_*` (webhook secret).
3. Universal PAT from the Hebrah dashboard → **Settings → MCP** (`hb_pat_*`).
4. `HEBRAH_SANDBOX_API_KEY` (`hb_test_...`) on **hebrah-mcp-host** `.env` (for `trigger_test_webhook`).

Quick path: [agent quickstart](https://github.com/Hebrah-inc/hebrah/blob/main/documentation/agent-quickstart.md).

## Setup

```bash
cd hebrah-examples/admit-monitor-demo
cp .env.example .env
# Edit .env: hbsec_*, hb_pat_*, HEBRAH_CONNECTION_ID
pnpm install
pnpm dev
```

Open http://localhost:3002.

### hebrah-mcp-host

```bash
cd hebrah-mcp-host
cp .env.example .env
# HEBRAH_SANDBOX_API_KEY=hb_test_...
pnpm dev
```

### Webhook URL

Register in **hebrah Settings → Webhook URL**:

| hebrah-api | URL |
|------------|-----|
| Docker | `http://host.docker.internal:3002/api/webhooks/hebrah` |
| Host | `http://localhost:3002/api/webhooks/hebrah` |

Set `NEXT_PUBLIC_APP_URL` to match (without the path).

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Env checklist, webhook URL, MCP connectivity |
| `/census` | Currently admitted patients |
| `/activity` | ADT feed + simulate admit/discharge via MCP |

## API routes

| Route | Description |
|-------|-------------|
| `POST /api/webhooks/hebrah` | Signed webhook receiver |
| `GET /api/census` | Admitted list + ADT feed |
| `POST /api/mcp/trigger` | MCP `trigger_test_webhook` |
| `GET /api/mcp/status` | MCP `get_account_status` |

## Operate with hebrah MCP (Cursor / agents)

1. Copy `.cursor/mcp.json` and set your `hb_pat_*` token.
2. Ensure hebrah-mcp-host has `HEBRAH_SANDBOX_API_KEY`.
3. Agent workflow:
   - `set_active_connection` with your sandbox `HEBRAH_CONNECTION_ID`
   - `trigger_test_webhook` with `event: patient.admitted` or `patient.discharged`
4. Watch **Census** update at http://localhost:3002/census

### CLI

```bash
pnpm mcp:admit
pnpm mcp:discharge pat_00000000_01
```

## Verify

1. Setup page shows MCP connected and env complete
2. Activity → **Simulate admit** → patient appears on Census
3. **Simulate discharge** → patient leaves Census
4. Cursor MCP tools produce the same flow without UI buttons

Events are in-memory only (cleared on restart).
