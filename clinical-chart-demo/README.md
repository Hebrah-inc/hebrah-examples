# clinical-chart-demo

Reference Next.js app for **synthetic EHR clinical chart** integration: connection-scoped patient IDs, chart reads via `GET /v1/sandbox/resources`, multi-scenario clinical triggers, HL7 inject, and webhook inbox.

Runs on port **3009**.

## Prerequisites

1. hebrah-api + hebrah-app running ([documentation/local-development.md](../../documentation/local-development.md))
2. Sandbox connection with sidecar VM (for `/parity` VM FHIR smoke)
3. `hb_test_*`, `hbsec_*`, and your sandbox **connection ID**

## Setup

```bash
cd hebrah-examples/clinical-chart-demo
cp .env.example .env
# Set HEBRAH_CONNECTION_ID to your sandbox connection
pnpm install
pnpm dev
```

Open http://localhost:3009.

## Webhook URL

Register in **hebrah Settings → Webhook URL** or on the connection **Tests** tab (per-connection override):

| hebrah-api | Webhook URL |
|------------|-------------|
| Docker | `http://host.docker.internal:3009/api/webhooks/hebrah` |
| Host | `http://localhost:3009/api/webhooks/hebrah` |

The Home page (`/`) shows both URLs for your environment.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Synthetic EHR profile + env checklist |
| `/patients` | Connection-scoped patient ID list |
| `/chart/[id]` | Demographics, problems, allergies, vitals, notes |
| `/clinical` | Scenario picker + HL7 clinical inject |
| `/parity` | Control-plane vs VM FHIR patient ID comparison |
| `/events` | Inbound webhook inbox (filter by event type) |

## Verify

1. Patients list shows `pat_{connection_seed}_01` style IDs
2. Chart page loads Condition / AllergyIntolerance / Observation / Composition samples
3. **`/clinical`** — run `allergy_documented` or inject `oru_r01_allergy` → webhooks on `/events` (auto-refreshes every 2s)
4. **`/parity`** — first control-plane Patient ID matches VM FHIR when sidecar is running

## Related docs

- [release-2026-12-synthetic-ehr-phase7.md](../../documentation/release-2026-12-synthetic-ehr-phase7.md)
- [release-2026-07-synthetic-ehr-rollout.md](../../documentation/release-2026-07-synthetic-ehr-rollout.md)
