# hebrah-examples

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Hebrah-inc/hebrah-examples.svg?style=social)](https://github.com/Hebrah-inc/hebrah-examples)
[![GitHub issues](https://img.shields.io/github/issues/Hebrah-inc/hebrah-examples.svg)](https://github.com/Hebrah-inc/hebrah-examples/issues)

Reference integration demos for the [Hebrah](https://hebrah.com) healthcare integration platform. Each demo is a self-contained Next.js app that exercises the [hebrah control plane](https://github.com/Hebrah-inc/hebrah-api) — synthetic FHIR sandboxes, HL7 inject, multi-step scenarios, and signed webhook delivery.

> **You need a Hebrah sandbox to run these demos.** Platform access is demo-gated. Request access at **[hebrah.com/request-demo](https://hebrah.com/request-demo)** and the team will follow up with `hb_test_*` API keys, `hbsec_*` webhook secrets, and a sandbox connection ID.

## Demos

| Demo | Path | Port | Description |
|------|------|------|-------------|
| Patient management | [`patient-demo/`](./patient-demo/) | **3001** | Next.js app — FHIR patient list/detail, webhook receiver, mock event triggers |
| Admit monitor | [`admit-monitor-demo/`](./admit-monitor-demo/) | **3002** | Next.js app — ADT census from webhooks, events via Hebrah hosted MCP |
| Prior auth monitor | [`prior-auth-demo/`](./prior-auth-demo/) | **3003** | Next.js app — PA task queue from `prior_auth.*` scenarios + webhooks |
| Webhook relay | [`webhook-relay-demo/`](./webhook-relay-demo/) | **3004** | Fault-injection webhook receiver for reliability testing |
| SMART app | [`smart-app-demo/`](./smart-app-demo/) | **3005** | SMART OAuth launch/code flow demo; fetches `Patient` via SMART token |
| MPI match | [`mpi-match-demo/`](./mpi-match-demo/) | **3006** | Queue for `patient.match.*` / `patient.merge.*` plus `mpi_merge_workflow` trigger |
| Credentialing | [`credentialing-demo/`](./credentialing-demo/) | **3007** | Queue for `credentialing.*` events plus `credentialing_happy_path` trigger |
| Aggregator | [`aggregator-demo/`](./aggregator-demo/) | **3008** | Proxy query to `/v1/sandbox/aggregator/query` with `aggregator.*` webhook inbox |
| Clinical chart | [`clinical-chart-demo/`](./clinical-chart-demo/) | **3009** | Connection-scoped clinical resources, chart view, `clinical_problem_lifecycle` |
| Research Pack Medicare | [`research-pack-medicare-demo/`](./research-pack-medicare-demo/) | **3012** | Medicare utilization Research Pack — CMS snapshot vs sandbox claim KPIs |
| Athena model agent | [`athena-model-agent-demo/`](./athena-model-agent-demo/) | — | Bring-your-own-model harness for MCP + integration-agent EHR workflows |

Future demos use ports **3013+** (avoid **3010** hebrah-admin / **3011** hebrah-local).

## Related repos

Hebrah publishes a few open source packages that pair with these demos:

- [`Hebrah-inc/hebrah-sdk-node`](https://github.com/Hebrah-inc/hebrah-sdk-node) — Node.js SDK (`@hebrah/sdk` on npm)
- [`Hebrah-inc/hebrah-sdk-python`](https://github.com/Hebrah-inc/hebrah-sdk-python) — Python SDK (`hebrah` on PyPI)
- [`Hebrah-inc/hebrah-vm-templates`](https://github.com/Hebrah-inc/hebrah-vm-templates) — NixOS microVM templates that power the sandbox sidecars
- [`Hebrah-inc/hebrah-sidecar`](https://github.com/Hebrah-inc/hebrah-sidecar) — legacy sidecar Nix flake
- [`Hebrah-inc/hebrah-api`](https://github.com/Hebrah-inc/hebrah-api) — the hebrah control plane these demos talk to

See [hebrah.com/open-source](https://hebrah.com/open-source) for the full list.

## Prerequisites

1. **Node.js 22+** and **pnpm 11+**
2. A running hebrah-api control plane — either local Docker Compose or hosted `https://api.hebrah.com`
3. Sandbox credentials from Hebrah onboarding:
   - `HEBRAH_SANDBOX_API_KEY` (`hb_test_*`) — bearer API key for the control plane
   - `HEBRAH_WEBHOOK_SECRET` (`hbsec_*`) — HMAC secret used to sign outbound webhooks
   - `HEBRAH_CONNECTION_ID` (`conn-sa-*`) — your sandbox connection ID
4. For `admit-monitor-demo`: a hosted MCP personal access token (`hb_pat_*`) from the Hebrah dashboard → **Settings → MCP**

If you don't have credentials yet, request access at [hebrah.com/request-demo](https://hebrah.com/request-demo).

## Connection-scoped patient IDs (Phase 10)

Sandbox patient IDs are **connection-scoped** (`pat_{connection_seed}_01`), not org-scoped. Copy `HEBRAH_CONNECTION_ID` (`conn-sa-...`) from your onboarding. Demos that list patients via `GET /v1/sandbox/catalog` pick up IDs automatically; demos with hardcoded defaults in `.env.example` should use the first ID from your catalog for that connection.

## Local setup

### Start the platform

Run hebrah-api locally with Docker Compose, or point your `.env` at a hosted control plane (`HEBRAH_API_BASE_URL=https://api.hebrah.com`).

The full local platform stack (hebrah-api, hebrah-app, hebrah-mcp-host) is documented in the umbrella repo's [local development guide](https://github.com/Hebrah-inc/hebrah/blob/main/documentation/local-development.md).

### Run a demo

```bash
cd patient-demo          # or any other demo folder
cp .env.example .env
# Fill in HEBRAH_SANDBOX_API_KEY, HEBRAH_WEBHOOK_SECRET, HEBRAH_CONNECTION_ID
pnpm install
pnpm dev                  # listens on the demo's assigned port
```

Each demo folder ships a more detailed README covering prerequisites, env vars, webhook URLs, and a smoke-test recipe.

### Register the webhook URL

In the Hebrah dashboard, go to **Settings → Webhook URL** and register the demo's URL:

| hebrah-api | Webhook URL pattern |
|------------|---------------------|
| Local Docker | `http://host.docker.internal:<port>/api/webhooks/hebrah` |
| Local host | `http://localhost:<port>/api/webhooks/hebrah` |
| Hosted | `https://<your-tunnel-or-deploy>/api/webhooks/hebrah` |

Replace `<port>` with the demo's port from the [demos table](#demos).

## Repository layout

```
hebrah-examples/
├── patient-demo/              # Port 3001 — basic FHIR + webhook receiver
├── admit-monitor-demo/        # Port 3002 — ADT census + hosted MCP
├── prior-auth-demo/           # Port 3003 — prior-auth queue
├── webhook-relay-demo/        # Port 3004 — fault-injection relay
├── smart-app-demo/            # Port 3005 — SMART on FHIR launch
├── mpi-match-demo/            # Port 3006 — MPI matching queue
├── credentialing-demo/        # Port 3007 — credentialing queue
├── aggregator-demo/           # Port 3008 — aggregator/HIE query
├── clinical-chart-demo/       # Port 3009 — clinical chart
├── research-pack-medicare-demo/ # Port 3012 — Medicare claims research pack
├── athena-model-agent-demo/   # BYOM harness for MCP + integration-agent
├── LICENSE                    # MIT
├── SECURITY.md                # vulnerability disclosure
├── CODE_OF_CONDUCT.md         # Contributor Covenant 2.1
├── CONTRIBUTING.md            # how to add demos, propose changes, file issues
└── CHANGELOG.md               # demo additions, removals, breaking changes
```

The root `.gitignore` covers Node/Next artifacts for every demo.

## Adding a demo

See [CONTRIBUTING.md](./CONTRIBUTING.md#proposing-a-new-demo) for the full proposal workflow. Short version:

1. Open an issue to discuss scope (a new integration surface deserves its own demo)
2. Pick the next free port in the sequence (currently 3013+)
3. Create a sibling folder with its own `package.json`, `pnpm-lock.yaml`, `README.md`, and `.env.example`
4. Add a row to the [demos table](#demos) above
5. Open a PR — maintainers review within a few business days

## Security

Found a security issue? Report it privately to **security@hebrah.com**. See [SECURITY.md](./SECURITY.md) for the full disclosure policy and scope.

Demos verify inbound webhooks with the `X-Hebrah-Signature` HMAC header before processing. Treat `hb_test_*`, `hbsec_*`, and `hb_pat_*` as bearer credentials — store in server-side env vars or a secrets manager, never in client code or committed `.env` files.

## License

[MIT](./LICENSE) © Hebrah, Inc.