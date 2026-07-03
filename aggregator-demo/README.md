# aggregator-demo

Minimal data aggregation query demo with signed webhook inbox.

Port **3008**.

## Setup

1. `cd aggregator-demo && cp .env.example .env`
2. `pnpm install && pnpm dev`
3. Set webhook URL to `http://localhost:3008/api/webhooks/hebrah`
4. Submit aggregator query form (proxied to `/v1/sandbox/aggregator/query`) and inspect webhook inbox for `aggregator.*`.
