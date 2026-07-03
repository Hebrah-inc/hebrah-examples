# prior-auth-demo

Reference Next.js app for **hebrah hosted MCP** + **signed webhooks**: maintain a prior authorization task queue from `prior_auth.*` events and multi-step scenarios.

Runs on port **3003** (see [hebrah-examples/README.md](../README.md)).

## Prerequisites

1. hebrah-api + hebrah-app + **hebrah-mcp-host** ([documentation/local-development.md](../../documentation/local-development.md))
2. hebrah onboarding credentials (`hbsec_*`, `hb_test_*`)
3. Universal PAT from hebrah-app **Settings → MCP** (`hb_pat_*`)
4. `HEBRAH_SANDBOX_API_KEY` on **hebrah-mcp-host** `.env` (for sandbox API tools)

Quick path: [documentation/agent-quickstart.md](../../documentation/agent-quickstart.md).

## Setup

```bash
cd hebrah-examples/prior-auth-demo
cp .env.example .env
# Edit .env: hbsec_*, hb_pat_*, HEBRAH_CONNECTION_ID
pnpm install
pnpm dev
```

Open http://localhost:3003.

### Webhook URL

Register in **hebrah Settings → Webhook URL**:

| hebrah-api | URL |
|------------|-----|
| Docker | `http://host.docker.internal:3003/api/webhooks/hebrah` |
| Host | `http://localhost:3003/api/webhooks/hebrah` |

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Env checklist, webhook URL, MCP connectivity |
| `/queue` | Prior auth tasks by status |
| `/patients/[id]` | Patient PA context |
| `/activity` | Event feed + run scenarios via MCP |

## Scenarios

Use **Activity** or MCP `run_sandbox_scenario`:

- `prior_auth_happy_path` — submitted → approved
- `prior_auth_pend_then_approve` — submitted → pended → approved
- `prior_auth_denial` — submitted → denied

## Agent workflow

1. `list_sandbox_domains` → pick `prior_auth`
2. `get_sandbox_domain` → read scenarios
3. `run_sandbox_scenario` with `prior_auth_happy_path`
4. Verify signed webhooks update `/queue`
