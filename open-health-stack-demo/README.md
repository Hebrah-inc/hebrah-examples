# Open Health Stack (OHS) + Hebrah Isolated Health Environment Demo

This reference demo (`port 3014`) demonstrates how the three pillars of the **[Open Health Stack (`ohs.foundation`)](https://ohs.foundation/)** (a Linux Foundation project originally launched by Google and the WHO) integrate directly with a **[Hebrah](https://hebrah.com) Isolated Health Environment** (`ambulatory_clinic` archetype + attached **PostgreSQL 16** module) using [`@hebrah/sdk`](https://www.npmjs.com/package/@hebrah/sdk) (`v0.9.2`):

1. **Pillar 1 — FHIR Foundations & Offline-First Structured Data Capture (`Questionnaire` / `QuestionnaireResponse`)**:
   - Serves a standardized HL7 FHIR R4 `Questionnaire` (`ohs-community-cardiometabolic-screen-v1`) modeled after WHO PEN & OHS primary-care screening protocols (LOINC-coded blood pressure, blood glucose, SpO2, PHQ-2 depression screen, and ICD-10 Z59/Z60 SDOH barriers).
   - Includes an interactive **Community Health Worker (CHW) Offline Capture Queue** that lets field users queue multiple `QuestionnaireResponse` screenings offline and batch-sync them to the Hebrah environment (`POST /api/sdc/sync`).
2. **Pillar 2 — `FhirDataPipes` SQL-on-FHIR Flattening (`PostgreSQL 16`)**:
   - Materializes two relational SQL-on-FHIR tables inside the environment's attached PostgreSQL 16 add-on:
     - `ohs_patient_flat_view`: Flattened FHIR `Patient` demographics, department, acuity, and primary condition.
     - `ohs_questionnaire_responses`: Flattened clinical metrics, WHO risk score/tier, and full `QuestionnaireResponse` JSON.
   - Executes live relational joins across `ohs_patient_flat_view` and `ohs_questionnaire_responses` (`GET /api/sql-on-fhir/analytics`) via credential-blind `client.db.query(...)`.
3. **Pillar 3 — `AI Commons` Clinical Triage & Safety Benchmark**:
   - Provides a 5-check **AI Commons Evaluation Suite** (`POST /api/ai-commons/evaluate` and `npm run evaluate`) inspired by the OHS study [*The "FHIR Tax" Is Shrinking*](https://ohs.foundation/blog/fhir-standards-tax.html), verifying FHIR SDC conformance, SQL-on-FHIR cohort flattening, WHO high-risk triage classification, structured outcome recording (`client.db.recordOutcome()`), and Hebrah's SQL AST / DLP safety guardrails.

---

## Quickstart

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate & Start the Interactive Web App (`Port 3014`)

The demo supports three ways to connect to a Hebrah Isolated Health Environment:

#### Option A (Recommended): Use Your Logged-In Hebrah CLI Account
Log in with [`@hebrah/cli`](https://www.npmjs.com/package/@hebrah/cli) so the environment, PostgreSQL 16 tables (`ohs_patient_flat_view`, `ohs_questionnaire_responses`), outcomes (`app_outcomes`), and audit logs appear directly inside your **Hebrah Dashboard UI**:

```bash
npx @hebrah/cli login
npm start
```

#### Option B: Pass Existing Environment Credentials

```bash
HEBRAH_API_KEY=hb_conn_... \
HEBRAH_ENV_ID=<env-uuid> \
HEBRAH_API_URL=https://api.hebrah.com \
npm start
```

#### Option C: Zero-Config `/SKILL.md` Headless Bootstrap
If neither `~/.hebrah/credentials` nor `HEBRAH_API_KEY` is present, `npm start` automatically reads `/SKILL.md`, self-registers a `$5.00` free trial agent account, and provisions an isolated `ambulatory_clinic` + PostgreSQL 16 environment:

```bash
npm start
```

Then open `http://127.0.0.1:3014` in your browser.

---

## Running the Verification & AI Commons Benchmark

```bash
# Run unit + live E2E verification:
npm run evaluate

# Run offline unit & SQLAlchemy bind-safety verification only:
node evaluate-ohs.mjs --unit
```

---

## API Routes (`http://127.0.0.1:3014`)

| Method & Path | Description |
| :--- | :--- |
| `GET /` | Interactive 3-panel OHS + Hebrah web application |
| `GET /api/health` | Environment health, wallet balance, FHIR R4 base URL, and SMART discovery URL |
| `GET /api/questionnaire` | Returns the canonical FHIR R4 `Questionnaire` (`ohs-community-cardiometabolic-screen-v1`) |
| `POST /api/sql-on-fhir/sync` | Flattens the clinic's FHIR R4 patient cohort into `ohs_patient_flat_view` in PostgreSQL 16 |
| `POST /api/sdc/sync` | Validates, scores, and batch-syncs FHIR `QuestionnaireResponse` screenings into `ohs_questionnaire_responses` + `app_outcomes` |
| `GET /api/sql-on-fhir/analytics` | Runs relational SQL-on-FHIR joins (`ohs_patient_flat_view` ⋈ `ohs_questionnaire_responses`) and risk-tier aggregations |
| `POST /api/ai-commons/evaluate` | Executes the 5-check OHS AI Commons clinical triage & safety guardrail benchmark |
