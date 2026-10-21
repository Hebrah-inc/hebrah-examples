# Hebrah Isolated Health Environment — Local Node.js Agent Demo & E2E Evaluator

This workspace example (`port 3013`) demonstrates an end-to-end **Node.js ICU Sepsis Triage & Real-Time Telemetry application** built with the published [`@hebrah/sdk`](https://www.npmjs.com/package/@hebrah/sdk) (`v0.9.2`), along with a comprehensive **7-phase AI Agent Evaluation Harness** (`55` checks) that starts from `/SKILL.md` discovery on `hebrah-www` (`https://hebrah-staging-www-76zyj6ngda-uc.a.run.app/`) and exercises:

1. **Agent Discovery & Content Negotiation** (`Accept: text/markdown`, `/SKILL.md`, `/.well-known/api-catalog`, `/.well-known/agent-configuration`, `/llms.txt`, `/robots.txt`)
2. **Self-Service Agent Registration & Registration Shield** (`POST /v1/agent/register` & `POST /v1/agent/account`, `$5.00` free trial credit, disposable domain blocking)
3. **Conversational Environment Architect, Hospital Provisioning & Hosted MCP** (`icu_critical_care`, PostgreSQL 16 module, Streamable HTTP MCP `initialize` + `tools/list`)
4. **Clinical Capability Packs & Data Retrieval** (PostgreSQL SQL joins, 5-tab EHR Patient Charts, FHIR R4 `Patient`, `$validate-code`, `$lookup`, `$translate`, `$export` / `bulk-export`, DICOMweb PACS QIDO-RS/WADO-RS/STOW-RS, IEEE 11073 device telemetry, IHE XDS.b & C-CDA 2.1, X12 5010 EDI, SDOH Z-codes & GA4GH genomics, Open-Data Catalog, Environment AI Studio)
5. **PostgreSQL Add-On Database Writes & Security Guardrails** (`CREATE TABLE`, parameterized `INSERT`/`UPDATE`, `client.db.recordOutcome()`, `client.environments.admitPatients()`, SQL AST destructive/cross-schema blocking, Inbound DLP SSN blocking)
6. **Real-Time WebSockets & Local Node.js Health App** (`wss://.../v1/environments/{id}/ws` `CONNECTED` handshake, `ping` -> `PONG` heartbeat, live HL7 v2 & telemetry broadcasts, and `HebrahAgentHarness` tool execution)
7. **Tamper-Evident Audit Trail, BOLA/IDOR Isolation, Zero-Leak Redaction & Auto-Idle Pause**

---

## Quickstart

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Full 7-Phase Staging E2E Agent Evaluation (`55` Checks)

```bash
npm run evaluate
# or against a custom WWW root:
WWW_URL=https://hebrah-staging-www-76zyj6ngda-uc.a.run.app node agent-e2e-eval.mjs
```

This outputs live pass/fail and latency metrics for every capability and writes a structured JSON report to `e2e-evaluation-results.json`.

### 3. Run the Interactive Local Node.js Health App Dashboard (`Port 3013`)

You can start the app with **zero configuration** (it automatically reads `/SKILL.md`, self-registers a `$5.00` free trial agent account, and provisions an isolated `icu_critical_care` + PostgreSQL 16 environment):

```bash
npm start
```

Or pass an existing API key and environment ID:

```bash
HEBRAH_API_KEY=hb_conn_... \
HEBRAH_ENV_ID=<env-uuid> \
HEBRAH_API_URL=https://hebrah-staging-api-76zyj6ngda-uc.a.run.app \
npm start
```

Then open `http://127.0.0.1:3013` in your browser to view the **ICU Sepsis & Real-Time Telemetry Command Center**, inspect 5-tab patient charts, write qSOFA/Lactate sepsis triage alerts directly to PostgreSQL 16, trigger clinical deterioration scenarios, and watch live HL7 v2 + IEEE 11073 WebSocket events stream in real time.
