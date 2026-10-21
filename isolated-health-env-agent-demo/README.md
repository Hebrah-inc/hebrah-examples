# Hebrah Isolated Health Environment — Local Node.js Agent Demo & E2E Evaluator

This workspace example demonstrates an end-to-end **Node.js clinical triage & real-time telemetry application** built with `@hebrah/sdk` (`v0.9.1`), along with a full **7-phase AI Agent Evaluation Harness** that starts from `SKILL.md` discovery on `hebrah-www` and exercises:

1. **Agent Discovery & Content Negotiation** (`Accept: text/markdown`, `/SKILL.md`, `/.well-known/api-catalog`, `/llms.txt`, `/robots.txt`)
2. **Self-Service Agent Registration & Registration Shield** (`POST /v1/agent/account`, `$5.00` free trial credit, disposable domain blocking)
3. **Conversational Environment Architect, Hospital Provisioning & Hosted MCP** (`icu_critical_care`, PostgreSQL 16 module, Streamable HTTP MCP `initialize` + `tools/list`)
4. **Clinical Capability Packs & Data Retrieval** (PostgreSQL SQL joins, 5-tab EHR Patient Charts, FHIR R4 `$validate-code`, `$lookup`, `$translate`, `$export`, DICOMweb PACS QIDO-RS/WADO-RS/STOW-RS, IEEE 11073 device telemetry, IHE XDS.b & C-CDA 2.1, SDOH Z-codes & GA4GH genomics, Open-Data Catalog)
5. **PostgreSQL Add-On Database Writes & Security Guardrails** (`CREATE TABLE`, parameterized `INSERT`/`UPDATE`, `client.db.recordOutcome()`, `client.environments.admitPatients()`, SQL AST destructive/cross-schema blocking, Inbound DLP SSN blocking)
6. **Real-Time WebSockets & Local Node.js Health App** (`wss://.../v1/environments/{id}/ws` `CONNECTED` handshake, `ping` -> `PONG` heartbeat, live HL7 v2 & telemetry broadcasts, and `HebrahAgentHarness` tool execution)
7. **Tamper-Evident Audit Trail, BOLA/IDOR Isolation & Zero-Leak Redaction**

---

## Quickstart

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Full 7-Phase Staging E2E Agent Evaluation

```bash
npm run evaluate
# or against a custom WWW root:
WWW_URL=https://hebrah-staging-www-76zyj6ngda-uc.a.run.app node agent-e2e-eval.mjs
```

This outputs live pass/fail and latency metrics for every capability and writes a structured JSON report to `e2e-evaluation-results.json`.

### 3. Run the Interactive Local Node.js Health App Dashboard

```bash
HEBRAH_API_KEY=hb_conn_... \
HEBRAH_ENVIRONMENT_ID=<env-uuid> \
HEBRAH_API_URL=https://hebrah-staging-api-76zyj6ngda-uc.a.run.app \
npm start
```

Then open `http://127.0.0.1:4040` in your browser to view the **ICU Sepsis & Real-Time Telemetry Command Center**, run SQL triage writebacks to PostgreSQL 16, trigger clinical scenarios, and watch live HL7 v2 + IEEE 11073 WebSocket events stream in real time.
