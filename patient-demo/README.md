# patient-demo

Reference Next.js app for hebrah sandbox integration: FHIR patient list/detail, signed webhook receiver, and mock clinical event triggers.

Runs on port **3001** by default (see [hebrah-examples/README.md](../README.md) for port conventions).

## Prerequisites

1. Start hebrah-api locally (Docker Compose) or point `HEBRAH_API_BASE_URL` at the hosted control plane. See the umbrella repo's [local development guide](https://github.com/Hebrah-inc/hebrah/blob/main/documentation/local-development.md).
2. Complete Hebrah onboarding at [hebrah.com/request-demo](https://hebrah.com/request-demo) and copy your sandbox credentials (`hb_test_*`, `hbsec_*`, connection ID `conn-sa-...`).

See the [agent quickstart](https://github.com/Hebrah-inc/hebrah/blob/main/documentation/agent-quickstart.md) for a 15-minute end-to-end setup.

## Setup

```bash
cd hebrah-examples/patient-demo
cp .env.example .env
# Edit .env with your hb_test_*, hbsec_*, and optional HEBRAH_CONNECTION_ID
pnpm install
pnpm dev
```

Open http://localhost:3001.

## Webhook URL

Register this URL in **hebrah Settings → Webhook URL**:

| hebrah-api runs on | Webhook URL |
|--------------------|-------------|
| Docker (default) | `http://host.docker.internal:3001/api/webhooks/hebrah` |
| Host | `http://localhost:3001/api/webhooks/hebrah` |

Use the same value for `NEXT_PUBLIC_APP_URL` (without the `/api/webhooks/hebrah` path).

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Env readiness, webhook URL, sandbox catalog health |
| `/patients` | List synthetic FHIR patients (up to 5) |
| `/patients/[id]` | Patient detail + admit/discharge triggers |
| `/events` | Inbound webhook inbox + trigger mock events |

## API routes (server)

| Route | Proxies |
|-------|---------|
| `GET /api/hebrah/catalog` | `GET /v1/sandbox/catalog` |
| `GET /api/hebrah/patients` | `GET /v1/patients` + patient hydration |
| `GET /api/hebrah/patients/[id]` | `GET /v1/patients/{id}` |
| `POST /api/hebrah/trigger` | `POST /v1/webhooks/trigger-mock-event` |
| `POST /api/webhooks/hebrah` | Inbound signed webhook receiver |
| `GET /api/webhooks/events` | In-memory webhook inbox |

## Verify

1. Setup page shows catalog with org name and **connection-scoped** sample patient IDs (`pat_{connection_seed}_01`)
2. Patients page lists sandbox patients
3. Events → **Send test webhook** → inbound row appears after delivery
4. Patient detail → **Admit patient** → webhook appears in Events inbox

Webhook events are stored in memory only (cleared on restart).
