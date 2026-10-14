# Changelog

All notable changes to the hebrah-examples reference demos are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Demos in this repo do not ship a versioned release train — `main` is the supported branch and demos are pinned by their own dependency manifests. Entries below mark notable demo additions, removals, and breaking changes.

## [Unreleased]

### Added

- **SDK `@hebrah/sdk@^0.9.0` adoption across all 11 demos**: unified control-plane API calls (`HebrahClient.sandbox.*`, `HebrahClient.webhooks.*`), `HEBRAH_ENVIRONMENT_ID` support, and `verifyWebhookSignature` across every Next.js and Node.js demo
- `athena-model-agent-demo`: added `package.json` and `.env.example` for reproducible standalone setup
- **Public release metadata:** `LICENSE` (MIT), `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- Clinical chart demo (`clinical-chart-demo`) — connection-scoped chart reads, parity view vs. sidecar VM FHIR, allergy/clinical scenario picker
- Research Pack Medicare demo (`research-pack-medicare-demo`) — CMS Medicare utilization snapshot vs. sandbox claim KPIs
- SMART on FHIR app demo (`smart-app-demo`) — SMART launch + code exchange + patient read
- Admit monitor demo now wires hebrah hosted MCP for agent-driven event triggering

### Security

- `patient-demo`: removed hardcoded fallback test credentials in `lib/env.ts`; now fails closed when `HEBRAH_SANDBOX_API_KEY` or `HEBRAH_WEBHOOK_SECRET` is unset
- `smart-app-demo`: hardened SMART proxy routes (`/api/smart/fhir`, `/api/smart/patient`, `/api/smart/token`) against SSRF and arbitrary path traversal by enforcing origin validation against `HEBRAH_API_BASE_URL`
- `prior-auth-demo`: added strict allowlist validation on `action` (`chart-note`, `prior-auth`, `medication-request`) and `patientId` in `/api/writeback`
- `clinical-chart-demo`: added strict regex validation for `[type]` and `[id]` in `/api/hebrah/vm-fhir/*` routes and removed internal VM URL disclosure in error responses
- All webhook receivers (`/api/webhooks/hebrah`): standardized on `@hebrah/sdk` `verifyWebhookSignature` and enforced HMAC verification on the raw body **before** `JSON.parse`; removed legacy `/api/webhooks/while` routes and `WHILE_*` / `x-while-signature` fallbacks

### Changed

- Demo READMEs now reference public hebrah docs (`https://hebrah.com`, `https://github.com/Hebrah-inc/hebrah`) instead of the internal umbrella `documentation/` folder
- Demo READMEs direct credential acquisition through the public demo request flow rather than internal onboarding

### Fixed

- `webhook-relay-demo`: fixed default port (`3004`) in `lib/env.ts` and MCP client identifier (`webhook-relay-demo`) in `lib/mcp-client.ts`
- clinical-chart-demo: prefer host-reachable FHIR for parity on hybrid (Ubuntu/Mac) dev
- clinical-chart-demo: allow `sharp` native builds in pnpm workspace

## [0.1.0] — 2026-05

### Added

- Initial public demos: `patient-demo`, `admit-monitor-demo`, `prior-auth-demo`, `webhook-relay-demo`, `mpi-match-demo`, `credentialing-demo`, `aggregator-demo`
- `athena-model-agent-demo` (bring-your-own-model harness for MCP + integration-agent)
- Root `README.md`, `.gitignore`, per-demo `package.json` and `.env.example`