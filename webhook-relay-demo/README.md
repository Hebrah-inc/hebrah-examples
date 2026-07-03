# webhook-relay-demo

Configurable fault-injection webhook receiver for hebrah **Phase 3 webhook reliability** testing.

Port **3004**.

## Setup

1. Start hebrah-api + hebrah-app
2. `cd webhook-relay-demo && cp .env.example .env` — set `HEBRAH_WEBHOOK_SECRET=hbsec_*`
3. `pnpm install && pnpm dev`
4. Register webhook URL: `http://localhost:3004/api/webhooks/hebrah` (or `host.docker.internal` from Docker API)

## Fault modes

| Mode | Behavior |
|------|----------|
| `healthy` | Accept all signed webhooks (200) |
| `503` | Reject with HTTP 503 |
| `429` | Reject with HTTP 429 |
| `slow` | Delay then accept (default 3s) |
| `random` | Probabilistic 503 (`RELAY_FAIL_RATE`) |
| `timeout` | Hang beyond client timeout |

Control via dashboard UI or `POST /api/mode`:

```bash
curl -s -X POST http://localhost:3004/api/mode \
  -H 'Content-Type: application/json' \
  -d '{"mode":"503"}'
```

## Agent workflow

1. Set relay to `503`, trigger `document.received`
2. `list_webhook_deliveries` — observe `pending` + retry
3. Set relay to `healthy`, wait for retry or `replay_webhook_delivery`

See [documentation/agent-quickstart.md](../../documentation/agent-quickstart.md) Track E.
