# credentialing-demo

Minimal credentialing scenario demo with signed webhook queue.

Port **3007**.

## Setup

1. `cd credentialing-demo && cp .env.example .env`
2. `pnpm install && pnpm dev`
3. Set webhook URL to `http://localhost:3007/api/webhooks/hebrah`
4. Trigger `credentialing_happy_path` and review `credentialing.*` inbox events.
