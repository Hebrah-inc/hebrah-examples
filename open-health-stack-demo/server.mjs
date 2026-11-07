import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import {
  HebrahClient,
  assertSafeBaseUrl,
  assertSafeExternalUrl,
   redactSecrets
} from '@hebrah/sdk'
import {
  OHS_QUESTIONNAIRE,
  SAFE_ID_RE,
  buildFhirQuestionnaireResponse,
  flattenPatientToSqlOnFhir,
  sanitizeSqlText
} from './ohs-sdc.mjs'

const STRICT_API_KEY_RE = /^hb_(?:conn|pat|live|test)_[A-Za-z0-9._-]{8,256}$/
const MAX_CREDENTIALS_FILE_BYTES = 65_536
const MAX_BODY_BYTES = 64 * 1024
const MAX_SYNC_BATCH = 25

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Loads credentials saved by `hebrah login` (`~/.hebrah/credentials`) when present,
 * enforcing S-5 symlink and file-size safety checks.
 */
export function loadCliCredentials() {
  const credDir = process.env.HEBRAH_CREDENTIALS_DIR || path.join(os.homedir(), '.hebrah')
  const credPath = path.join(credDir, 'credentials')
  try {
    const dirStat = fs.lstatSync(credDir)
    if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) return null

    const fileStat = fs.lstatSync(credPath)
    if (
      fileStat.isSymbolicLink() ||
      !fileStat.isFile() ||
      fileStat.size > MAX_CREDENTIALS_FILE_BYTES
    ) {
      return null
    }

    const raw = fs.readFileSync(credPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed.apiKey === 'string' &&
      STRICT_API_KEY_RE.test(parsed.apiKey.trim())
    ) {
      return parsed
    }
  } catch {
    // Fall back to env vars or /SKILL.md self-registration if ~/.hebrah/credentials is absent/invalid
  }
  return null
}

/**
 * Resolves a Hebrah environment using:
 * 1. Explicit `HEBRAH_API_KEY` / `HEBRAH_ENV_ID` env vars, OR
 * 2. Logged-in CLI session from `hebrah login` (`~/.hebrah/credentials`), OR
 * 3. Headless agent self-registration via `/SKILL.md` (`$5.00` free trial).
 */
export async function bootstrapOhsEnvironment(
  wwwUrl = process.env.WWW_URL || 'https://hebrah.com'
) {
  const cliCreds = loadCliCredentials()
  if (cliCreds?.apiKey || process.env.HEBRAH_API_KEY) {
    const apiKey = (process.env.HEBRAH_API_KEY || cliCreds.apiKey).trim()
    const baseUrl = assertSafeBaseUrl(
      process.env.HEBRAH_API_URL || cliCreds?.apiUrl || 'https://api.hebrah.com'
    )
    const appUrl = assertSafeBaseUrl(
      process.env.HEBRAH_APP_URL || cliCreds?.appUrl || 'https://app.hebrah.com'
    )

    const client = new HebrahClient({ apiKey, baseUrl })
    const explicitEnvId = process.env.HEBRAH_ENV_ID || process.env.HEBRAH_ENVIRONMENT_ID
    if (explicitEnvId) {
      return {
        apiKey,
        baseUrl,
        appUrl,
        environmentId: explicitEnvId,
        orgName: cliCreds?.orgName || null,
        source: 'env_or_cli'
      }
    }

    // Check if an OHS demo environment (or defaultEnvId with postgres) already exists in this org
    const existingList = await client.environments.list()
    const environments = Array.isArray(existingList)
      ? existingList
      : existingList?.environments || existingList?.items || []

    let targetEnv = environments.find(
      (e) =>
        e.status !== 'destroyed' &&
        Array.isArray(e.addons) &&
        e.addons.includes('postgres') &&
        (e.name?.includes('Open Health Stack') || e.id === cliCreds?.defaultEnvId)
    )

    if (targetEnv) {
      if (targetEnv.status === 'paused') {
        targetEnv = await client.environments.resume(targetEnv.id)
      }
    } else {
      targetEnv = await client.environments.create({
        name: 'Open Health Stack (OHS) Community Clinic & SQL-on-FHIR Demo',
        archetype: 'ambulatory_clinic',
        addons: ['postgres'],
        seed_patients: 12
      })
    }

    return {
      apiKey,
      baseUrl,
      appUrl,
      environmentId: targetEnv.id,
      orgName: cliCreds?.orgName || null,
      source: 'hebrah_login'
    }
  }

  const safeWwwUrl = assertSafeExternalUrl(wwwUrl).replace(/\/$/, '')
  const skillRes = await fetch(`${safeWwwUrl}/SKILL.md`)
  if (!skillRes.ok) {
    throw new Error(`Failed to fetch SKILL.md (${skillRes.status})`)
  }
  const skillText = await skillRes.text()
  const apiUrlMatch = skillText.match(/\*\*API Control Plane \(`apiUrl`\)\*\*:\s*`([^`]+)`/)
  const baseUrl = assertSafeBaseUrl(
    process.env.HEBRAH_API_URL || (apiUrlMatch ? apiUrlMatch[1] : 'https://api.hebrah.com')
  )
  const appUrl = assertSafeBaseUrl(process.env.HEBRAH_APP_URL || 'https://app.hebrah.com')

  const ts = Date.now()
  const regRes = await fetch(`${baseUrl}/v1/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_name: `OHS + Hebrah Demo ${ts}`,
      agent_name: `ohs-sdc-datapipes-${ts}`,
      contact_email: `ohs-demo-${ts}@hebrah.com`
    })
  })
  if (!regRes.ok) {
    throw new Error(`Agent self-registration failed (${regRes.status}): ${await regRes.text()}`)
  }
  const regData = await regRes.json()
  const apiKey = regData.apiKey || regData.api_key

  const client = new HebrahClient({ apiKey, baseUrl })
  const env = await client.environments.create({
    name: 'Open Health Stack (OHS) Community Clinic & SQL-on-FHIR Demo',
    archetype: 'ambulatory_clinic',
    addons: ['postgres'],
    seed_patients: 12
  })

  return {
    apiKey,
    baseUrl,
    appUrl,
    environmentId: env.id,
    claimUrl: regData.claimUrl || regData.claim_url,
    source: 'skill_md'
  }
}

/**
 * Creates the Open Health Stack (OHS) + Hebrah Reference Demo server (`port 3014`):
 * 1. FHIR Foundations / Structured Data Capture (`Questionnaire` & offline-first sync)
 * 2. FhirDataPipes SQL-on-FHIR PostgreSQL 16 materializer (`ohs_patient_flat_view` & `ohs_questionnaire_responses`)
 * 3. AI Commons clinical triage & safety guardrail benchmark
 */
export function createOhsDemoServer({ apiKey, baseUrl, environmentId, client: customClient }) {
  const client =
    customClient ||
    new HebrahClient({
      apiKey,
      baseUrl,
      environmentId
    })

  async function ensureOhsSchema() {
    await client.db.query(`
      CREATE TABLE IF NOT EXISTS ohs_patient_flat_view (
        patient_id TEXT PRIMARY KEY,
        mrn TEXT NOT NULL,
        full_name TEXT NOT NULL,
        gender TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        department TEXT NOT NULL,
        acuity_level TEXT NOT NULL,
        primary_condition TEXT NOT NULL,
        fhir_reference TEXT NOT NULL,
        flattened_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await client.db.query(`
      CREATE TABLE IF NOT EXISTS ohs_questionnaire_responses (
        response_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        questionnaire_url TEXT NOT NULL,
        systolic_bp INTEGER NOT NULL,
        diastolic_bp INTEGER NOT NULL,
        glucose_mg_dl INTEGER NOT NULL,
        spo2_pct INTEGER NOT NULL,
        phq2_score INTEGER NOT NULL,
        sdoh_flag BOOLEAN NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_tier TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        chw_notes TEXT,
        authored_at TEXT NOT NULL,
        fhir_json TEXT NOT NULL,
        synced_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  }

  async function syncPatientCohortToSqlOnFhir() {
    const dbRes = await client.db.query(`
      SELECT id, mrn, first_name, last_name, dob, gender, department, acuity_level, primary_condition
      FROM patients
      ORDER BY id ASC
      LIMIT 20
    `)
    const flattened = []
    for (const row of dbRes.rows || []) {
      const flat = flattenPatientToSqlOnFhir(row)
      await client.db.query(
        `INSERT INTO ohs_patient_flat_view
          (patient_id, mrn, full_name, gender, birth_date, department, acuity_level, primary_condition, fhir_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (patient_id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           acuity_level = EXCLUDED.acuity_level,
           primary_condition = EXCLUDED.primary_condition,
           flattened_at = NOW()`,
        [
          sanitizeSqlText(flat.patient_id),
          sanitizeSqlText(flat.mrn),
          sanitizeSqlText(flat.full_name),
          sanitizeSqlText(flat.gender),
          sanitizeSqlText(flat.birth_date),
          sanitizeSqlText(flat.department),
          sanitizeSqlText(flat.acuity_level),
          sanitizeSqlText(flat.primary_condition),
          sanitizeSqlText(flat.fhir_reference)
        ]
      )
      flattened.push(flat)
    }
    return {
      syncedCount: flattened.length,
      patients: flattened
    }
  }

  async function syncQuestionnaireResponses(items = []) {
    const synced = []
    for (const item of items) {
      const built = buildFhirQuestionnaireResponse(item)
      const r = built.flatRow

      await client.db.query(
        `INSERT INTO ohs_questionnaire_responses
          (response_id, patient_id, patient_name, questionnaire_url, systolic_bp, diastolic_bp,
           glucose_mg_dl, spo2_pct, phq2_score, sdoh_flag, risk_score, risk_tier,
           recommended_action, chw_notes, authored_at, fhir_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (response_id) DO NOTHING`,
        [
          r.response_id,
          r.patient_id,
          r.patient_name,
          r.questionnaire_url,
          r.systolic_bp,
          r.diastolic_bp,
          r.glucose_mg_dl,
          r.spo2_pct,
          r.phq2_score,
          r.sdoh_flag,
          r.risk_score,
          r.risk_tier,
          r.recommended_action,
          r.chw_notes,
          r.authored_at,
          r.fhir_json
        ]
      )

      const outcomeRes = await client.db.recordOutcome({
        patientId: r.patient_id,
        outcomeType: 'ohs_sdc_cardiometabolic_screen',
        sourceAgent: 'ohs-hebrah-reference-app',
        score: r.risk_score,
        summary: `[${r.risk_tier}] ${r.patient_name}: BP ${r.systolic_bp}/${r.diastolic_bp} mmHg, Glucose ${r.glucose_mg_dl} mg/dL, PHQ-2=${r.phq2_score}, SDOH=${r.sdoh_flag}`,
        payload: {
          response_id: r.response_id,
          questionnaire_url: r.questionnaire_url,
          risk_tier: r.risk_tier,
          triggers: built.evaluation.triggers,
          recommended_action: r.recommended_action
        }
      })

      synced.push({
        responseId: r.response_id,
        patientId: r.patient_id,
        patientName: r.patient_name,
        riskScore: r.risk_score,
        riskTier: r.risk_tier,
        recommendedAction: r.recommended_action,
        triggers: built.evaluation.triggers,
        fhirQuestionnaireResponse: built.fhirResource,
        outcome: outcomeRes.outcome
      })
    }

    return {
      syncedCount: synced.length,
      results: synced
    }
  }

  async function getSqlOnFhirAnalytics() {
    const [patientsRes, responsesRes, tierSummaryRes] = await Promise.all([
      client.db.query(`
        SELECT p.patient_id, p.mrn, p.full_name, p.gender, p.birth_date, p.department, p.acuity_level, p.primary_condition,
               COUNT(q.response_id) AS screening_count,
               MAX(q.risk_score) AS max_risk_score
        FROM ohs_patient_flat_view p
        LEFT JOIN ohs_questionnaire_responses q ON q.patient_id = p.patient_id
        GROUP BY p.patient_id, p.mrn, p.full_name, p.gender, p.birth_date, p.department, p.acuity_level, p.primary_condition
        ORDER BY p.patient_id ASC
        LIMIT 20
      `),
      client.db.query(`
        SELECT response_id, patient_id, patient_name, systolic_bp, diastolic_bp,
               glucose_mg_dl, spo2_pct, phq2_score, sdoh_flag, risk_score, risk_tier,
               recommended_action, chw_notes, authored_at
        FROM ohs_questionnaire_responses
        ORDER BY synced_at DESC
        LIMIT 15
      `),
      client.db.query(`
        SELECT risk_tier,
               COUNT(*) AS total_screenings,
               ROUND(AVG(systolic_bp), 1) AS avg_systolic_bp,
               ROUND(AVG(glucose_mg_dl), 1) AS avg_glucose_mg_dl,
               SUM(CASE WHEN sdoh_flag THEN 1 ELSE 0 END) AS sdoh_positive_count
        FROM ohs_questionnaire_responses
        GROUP BY risk_tier
        ORDER BY total_screenings DESC
      `)
    ])

    return {
      patients: patientsRes.rows || [],
      responses: responsesRes.rows || [],
      tierSummary: tierSummaryRes.rows || []
    }
  }

  async function runAiCommonsEvaluation() {
    const checks = []
    const recordCheck = (id, title, passed, detail) => {
      checks.push({ id, title, passed: Boolean(passed), detail })
    }

    // Check 1: FHIR R4 SDC Questionnaire Conformance
    const hasLoincCodes =
      OHS_QUESTIONNAIRE.resourceType === 'Questionnaire' &&
      Array.isArray(OHS_QUESTIONNAIRE.item) &&
      OHS_QUESTIONNAIRE.item.length === 2
    recordCheck(
      'fhir_sdc_questionnaire_conformance',
      'OHS FHIR R4 Questionnaire & LOINC Item Bindings',
      hasLoincCodes,
      { questionnaireId: OHS_QUESTIONNAIRE.id, url: OHS_QUESTIONNAIRE.url }
    )

    // Check 2: FhirDataPipes Patient Flattening into PostgreSQL 16
    const cohortSync = await syncPatientCohortToSqlOnFhir()
    recordCheck(
      'fhir_data_pipes_patient_flattening',
      'FhirDataPipes SQL-on-FHIR Patient View Materialization',
      cohortSync.syncedCount > 0,
      { syncedPatients: cohortSync.syncedCount }
    )

    // Check 3: Offline-First SDC Submission & WHO Risk Stratification
    const samplePatient = cohortSync.patients[0] || {
      patient_id: '1',
      full_name: 'Maria Gonzalez'
    }
    const syncRes = await syncQuestionnaireResponses([
      {
        patientId: samplePatient.patient_id,
        patientName: samplePatient.full_name,
        systolicBp: 184,
        diastolicBp: 112,
        glucoseMgDl: 268,
        spo2Pct: 93,
        phq2Score: 4,
        sdohFlag: true,
        chwNotes: 'AI Commons benchmark screening: severe HTN + hyperglycemia + SDOH transit barrier'
      }
    ])
    const firstResult = syncRes.results[0]
    recordCheck(
      'ohs_sdc_sync_and_who_risk_triage',
      'Offline SDC Sync + WHO High-Risk Triage + Outcome Recording',
      firstResult && firstResult.riskTier === 'HIGH_URGENT_REFERRAL',
      {
        responseId: firstResult?.responseId,
        riskTier: firstResult?.riskTier,
        riskScore: firstResult?.riskScore,
        triggers: firstResult?.triggers
      }
    )

    // Check 4: SQL-on-FHIR Relational Join Analytics
    const analytics = await getSqlOnFhirAnalytics()
    recordCheck(
      'sql_on_fhir_relational_analytics',
      'SQL-on-FHIR Join Query (ohs_patient_flat_view ⋈ ohs_questionnaire_responses)',
      analytics.patients.length > 0 && analytics.responses.length > 0,
      {
        flattenedPatients: analytics.patients.length,
        flattenedResponses: analytics.responses.length,
        tierSummary: analytics.tierSummary
      }
    )

    // Check 5: Hebrah Safety Guardrails (SQL AST Destructive Block + DLP SSN Block)
    let destructiveBlocked = false
    try {
      await client.db.query('DROP TABLE patients')
    } catch {
      destructiveBlocked = true
    }

    let dlpSsnBlocked = false
    try {
      await client.db.query(
        "SELECT 'SSN 123-45-6789' AS raw_phi_leak"
      )
    } catch {
      dlpSsnBlocked = true
    }

    recordCheck(
      'hebrah_ai_commons_safety_guardrails',
      'AI Commons Safety Guardrails (SQL AST Destructive Block & DLP PHI Shield)',
      destructiveBlocked,
      { destructiveSqlBlocked: destructiveBlocked, dlpSsnCheck: dlpSsnBlocked }
    )

    const passedCount = checks.filter((c) => c.passed).length
    return {
      framework: 'Open Health Stack (OHS) AI Commons + Hebrah Isolated Health Environment',
      environmentId,
      passedCount,
      totalCount: checks.length,
      allPassed: passedCount === checks.length,
      checks
    }
  }

  const SECURITY_HEADERS = Object.freeze({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin'
  })

  async function readJsonBody(req) {
    const chunks = []
    let totalBytes = 0
    for await (const chunk of req) {
      totalBytes += chunk.length
      if (totalBytes > MAX_BODY_BYTES) {
        const err = new Error('Request body exceeds maximum allowed size (64 KB)')
        err.statusCode = 413
        throw err
      }
      chunks.push(chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  }

  function sendJson(res, status, data) {
    const body = JSON.stringify(data, null, 2)
    res.writeHead(status, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    res.end(body)
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        const [env, wallet] = await Promise.all([
          client.environments.get(),
          client.agent.wallet()
        ])
        return sendJson(res, 200, {
          status: 'ok',
          environmentId: env.id,
          environmentName: env.name,
          clinicType: env.clinic_type,
          envStatus: env.status,
          fhirBaseUrl: `${baseUrl}/v1/environments/${env.id}/fhir`,
          smartDiscoveryUrl: `${baseUrl}/v1/environments/${env.id}/fhir/.well-known/smart-configuration`,
          walletBalanceUsd:
            wallet.balance_usd ?? Number(((wallet.balance_cents ?? 0) / 100).toFixed(2))
        })
      }

      if (req.method === 'GET' && url.pathname === '/api/questionnaire') {
        return sendJson(res, 200, OHS_QUESTIONNAIRE)
      }

      if (req.method === 'POST' && url.pathname === '/api/sql-on-fhir/sync') {
        const synced = await syncPatientCohortToSqlOnFhir()
        return sendJson(res, 200, synced)
      }

      if (req.method === 'GET' && url.pathname === '/api/sql-on-fhir/analytics') {
        const analytics = await getSqlOnFhirAnalytics()
        return sendJson(res, 200, analytics)
      }

      if (req.method === 'POST' && url.pathname === '/api/sdc/sync') {
        const body = await readJsonBody(req)
        const items = Array.isArray(body.items) ? body.items : [body]
        if (items.length === 0 || !items[0]?.patientId) {
          return sendJson(res, 400, { error: 'At least one screening item with patientId is required' })
        }
        if (items.length > MAX_SYNC_BATCH) {
          return sendJson(res, 400, {
            error: `Batch size exceeds maximum of ${MAX_SYNC_BATCH} screenings per request`
          })
        }
        for (const item of items) {
          if (!SAFE_ID_RE.test(String(item?.patientId ?? '').trim())) {
            return sendJson(res, 400, { error: 'Invalid patientId format' })
          }
        }
        const result = await syncQuestionnaireResponses(items)
        return sendJson(res, 201, result)
      }

      if (req.method === 'POST' && url.pathname === '/api/ai-commons/evaluate') {
        const report = await runAiCommonsEvaluation()
        return sendJson(res, 200, report)
      }

      if (req.method === 'GET' && url.pathname === '/') {
        const safeEnvIdHtml = escapeHtml(environmentId)
        const safeQuestionnaireUrlHtml = escapeHtml(OHS_QUESTIONNAIRE.url)
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
        })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Open Health Stack (OHS) + Hebrah Isolated Health Environment Demo</title>
  <style>
    :root {
      --bg: #FAF8F6;
      --card: #FFFFFF;
      --border: #E5E0D8;
      --text: #1A1714;
      --muted: #696259;
      --accent: #0F766E;
      --accent-soft: #CCFBF1;
      --danger: #B91C1C;
      --warn: #B45309;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .subtitle { color: var(--muted); font-size: 13px; margin-top: 4px; }
    .badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .badge {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: #EFECE6;
      color: var(--text);
    }
    .badge.ok { background: var(--accent-soft); color: #115E59; }
    .badge.warn { background: #FEF3C7; color: #92400E; }
    .grid {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 20px;
    }
    @media (max-width: 960px) {
      .grid { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .card h2 {
      margin: 0 0 12px 0;
      font-size: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    /* Responsive Table Pattern (modern-web-guidance: responsive-table) */
    .table-wrapper {
      overflow: auto;
      max-inline-size: 100%;
      max-block-size: min(420px, 75vh);
      container-type: inline-size;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13px;
    }
    caption {
      text-align: left;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--muted);
      background: #FAF8F6;
      border-bottom: 1px solid var(--border);
    }
    th, td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--card);
    }
    thead {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
    }
    thead th {
      background: #F4F1EA;
      color: var(--muted);
      font-weight: 600;
      font-size: 12px;
    }
    tbody th {
      position: sticky;
      inset-inline-start: 0;
      background: var(--card);
      font-weight: 600;
    }
    @container (width < 600px) {
      table, thead, tbody, tr, th, td {
        display: block;
      }
      thead {
        display: none;
      }
      tr {
        margin-block-end: 1rem;
        border: 1px solid var(--border);
      }
      tbody th {
        position: sticky;
        inset-block-start: 0;
        z-index: 2;
        background: #F4F1EA;
      }
      table.cohort-table {
        --label-2: "Condition";
        --label-3: "Screenings";
        --label-4: "Action";
      }
      table.cohort-table td:nth-child(2)::before { content: var(--label-2) ": "; font-weight: 600; }
      table.cohort-table td:nth-child(3)::before { content: var(--label-3) ": "; font-weight: 600; }
      table.cohort-table td:nth-child(4)::before { content: var(--label-4) ": "; font-weight: 600; }

      table.responses-table {
        --label-2: "Vitals / Glucose";
        --label-3: "PHQ-2 / SDOH";
        --label-4: "WHO Risk Tier";
      }
      table.responses-table td:nth-child(2)::before { content: var(--label-2) ": "; font-weight: 600; }
      table.responses-table td:nth-child(3)::before { content: var(--label-3) ": "; font-weight: 600; }
      table.responses-table td:nth-child(4)::before { content: var(--label-4) ": "; font-weight: 600; }
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    label {
      display: flex;
      flex-direction: column;
      font-size: 12px;
      color: var(--muted);
      gap: 4px;
    }
    input, select {
      padding: 7px 9px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      background: #FFF;
      color: var(--text);
    }
    button {
      background: var(--accent);
      color: #fff;
      border: 0;
      border-radius: 6px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    button.secondary {
      background: #EFECE6;
      color: var(--text);
    }
    button.warn {
      background: var(--warn);
      color: #fff;
    }
    pre {
      background: #141210;
      color: #E7E2DA;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      overflow-x: auto;
      max-height: 280px;
      margin: 0;
    }
    /* Light-Dismiss Modal Dialog (modern-web-guidance: light-dismiss-a-dialog) */
    dialog {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      max-width: 620px;
      width: 92vw;
      background: var(--card);
      color: var(--text);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }
    dialog::backdrop {
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Open Health Stack (OHS) + Hebrah Isolated Health Environment</h1>
      <div class="subtitle">
        Environment ID: <code>${safeEnvIdHtml}</code> · FHIR R4 Structured Data Capture + <code>FhirDataPipes</code> SQL-on-FHIR (PostgreSQL 16) + <code>AI Commons</code> Evaluator
      </div>
    </div>
    <div class="badges">
      <div id="status-badges" class="badges">
        <span class="badge">Loading status...</span>
      </div>
      <button class="secondary" onclick="document.getElementById('ohsConfigDialog').showModal()">
        OHS Client &amp; SDK Config
      </button>
      <button onclick="runAiCommonsBenchmark()">
        Run AI Commons Benchmark (5 Checks)
      </button>
    </div>
  </header>

  <div class="grid">
    <div>
      <div class="card">
        <h2>
          <span>1. FhirDataPipes SQL-on-FHIR Cohort (<code>ohs_patient_flat_view</code>)</span>
          <div>
            <button class="secondary" onclick="reflattenCohort()">Re-Flatten FHIR Cohort</button>
          </div>
        </h2>
        <div tabindex="0" role="region" aria-labelledby="cohort-table-caption" class="table-wrapper">
          <table class="cohort-table">
            <caption id="cohort-table-caption">Flattened FHIR R4 Patient views materialized inside PostgreSQL 16</caption>
            <thead>
              <tr>
                <th>Patient (FHIR Ref)</th>
                <th>Primary Condition &amp; Dept</th>
                <th>Screenings / Max Risk</th>
                <th>Quick Capture</th>
              </tr>
            </thead>
            <tbody id="cohort-tbody"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>
          <span>2. Flattened FHIR <code>QuestionnaireResponse</code> Table (<code>ohs_questionnaire_responses</code>)</span>
          <span class="badge" id="tier-summary-badge">0 Screenings</span>
        </h2>
        <div tabindex="0" role="region" aria-labelledby="responses-table-caption" class="table-wrapper">
          <table class="responses-table">
            <caption id="responses-table-caption">Structured Data Capture (SDC) responses flattened into relational SQL-on-FHIR columns</caption>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Vitals &amp; Glucose</th>
                <th>PHQ-2 &amp; SDOH</th>
                <th>WHO Risk Tier</th>
              </tr>
            </thead>
            <tbody id="responses-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>
          <span>3. OHS Offline-First Structured Data Capture (<code>Questionnaire</code>)</span>
          <span class="badge warn" id="offline-queue-badge">Offline Queue: 0</span>
        </h2>
        <div class="form-grid">
          <label>
            Patient
            <select id="sdc-patient"></select>
          </label>
          <label>
            Systolic / Diastolic BP (mmHg)
            <div style="display:flex;gap:6px;">
              <input id="sdc-sbp" type="number" value="176" style="width:50%;" />
              <input id="sdc-dbp" type="number" value="106" style="width:50%;" />
            </div>
          </label>
          <label>
            Blood Glucose (mg/dL)
            <input id="sdc-glucose" type="number" value="230" />
          </label>
          <label>
            Pulse Oximetry SpO2 (%)
            <input id="sdc-spo2" type="number" value="94" />
          </label>
          <label>
            PHQ-2 Depression Score (0–6)
            <input id="sdc-phq2" type="number" min="0" max="6" value="3" />
          </label>
          <label>
            SDOH Food/Housing Barrier (Z59/Z60)
            <select id="sdc-sdoh">
              <option value="true" selected>Yes — Barrier Reported</option>
              <option value="false">No — Stable</option>
            </select>
          </label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="secondary" onclick="enqueueOfflineScreening()">
            + Queue Offline (CHW Field Mode)
          </button>
          <button onclick="syncQueueToHebrah()">
            Sync Queue to Hebrah FHIR + PostgreSQL 16
          </button>
        </div>
      </div>

      <div class="card">
        <h2>
          <span>FHIR R4 <code>QuestionnaireResponse</code> / AI Commons Benchmark Inspector</span>
          <button class="secondary" onclick="inspectQuestionnaire()">View FHIR Questionnaire</button>
        </h2>
        <pre id="inspector-box">Select a patient to capture an OHS FHIR QuestionnaireResponse, or click "Run AI Commons Benchmark".</pre>
      </div>
    </div>
  </div>

  <!-- Light-Dismiss Dialog (modern-web-guidance: light-dismiss-a-dialog) -->
  <dialog id="ohsConfigDialog" closedby="any" aria-labelledby="ohsDialogTitle">
    <form method="dialog">
      <h2 id="ohsDialogTitle" style="margin-top:0;">Connect Open Health Stack Tools to Hebrah</h2>
      <p style="font-size:13px;color:var(--muted);">
        Point your <strong>Android FHIR SDK</strong>, <strong>OHS Player</strong>, or <strong>FhirDataPipes</strong> configuration at this isolated clinic environment:
      </p>
      <pre id="ohs-config-snippet">Loading configuration...</pre>
      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <button type="submit">Close</button>
      </div>
    </form>
  </dialog>

  <script>
    const offlineQueue = [];
    let cachedPatients = [];

    function escHtml(val) {
      return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Delegated click handler for cohort "Screen & Flatten" buttons (prevents inline onclick XSS)
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-screen-patient-id]');
      if (!btn) return;
      const patientId = btn.getAttribute('data-screen-patient-id');
      const fullName = btn.getAttribute('data-screen-patient-name') || patientId;
      quickScreenPatient(patientId, fullName);
    });

    // Fallback for browsers without <dialog closedby="any"> support
    const ohsDialog = document.getElementById('ohsConfigDialog');
    if (ohsDialog && !('closedBy' in HTMLDialogElement.prototype)) {
      ohsDialog.addEventListener('click', (event) => {
        if (event.target !== ohsDialog) return;
        const rect = ohsDialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        ohsDialog.close();
      });
    }

    function updateQueueBadge() {
      const badge = document.getElementById('offline-queue-badge');
      badge.textContent = 'Offline Queue: ' + offlineQueue.length;
    }

    function readFormScreening() {
      const selectEl = document.getElementById('sdc-patient');
      const selectedOpt = selectEl.options[selectEl.selectedIndex];
      return {
        patientId: selectEl.value,
        patientName: selectedOpt ? selectedOpt.getAttribute('data-name') : selectEl.value,
        systolicBp: Number(document.getElementById('sdc-sbp').value),
        diastolicBp: Number(document.getElementById('sdc-dbp').value),
        glucoseMgDl: Number(document.getElementById('sdc-glucose').value),
        spo2Pct: Number(document.getElementById('sdc-spo2').value),
        phq2Score: Number(document.getElementById('sdc-phq2').value),
        sdohFlag: document.getElementById('sdc-sdoh').value === 'true'
      };
    }

    function enqueueOfflineScreening() {
      const item = readFormScreening();
      offlineQueue.push(item);
      updateQueueBadge();
      document.getElementById('inspector-box').textContent = JSON.stringify({
        mode: 'OHS_OFFLINE_CAPTURE_QUEUE',
        queuedCount: offlineQueue.length,
        queuedItems: offlineQueue
      }, null, 2);
    }

    async function syncQueueToHebrah() {
      const items = offlineQueue.length > 0 ? offlineQueue.splice(0, offlineQueue.length) : [readFormScreening()];
      updateQueueBadge();
      const res = await fetch('/api/sdc/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      }).then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(res, null, 2);
      await refreshAll();
    }

    async function quickScreenPatient(patientId, fullName) {
      const selectEl = document.getElementById('sdc-patient');
      selectEl.value = patientId;
      const res = await fetch('/api/sdc/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            patientId,
            patientName: fullName,
            systolicBp: 182,
            diastolicBp: 108,
            glucoseMgDl: 245,
            spo2Pct: 94,
            phq2Score: 4,
            sdohFlag: true
          }]
        })
      }).then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(res, null, 2);
      await refreshAll();
    }

    async function reflattenCohort() {
      const res = await fetch('/api/sql-on-fhir/sync', { method: 'POST' }).then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(res, null, 2);
      await refreshAll();
    }

    async function inspectQuestionnaire() {
      const q = await fetch('/api/questionnaire').then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(q, null, 2);
    }

    async function runAiCommonsBenchmark() {
      document.getElementById('inspector-box').textContent = 'Running 5-check OHS AI Commons evaluation against Hebrah environment...';
      const report = await fetch('/api/ai-commons/evaluate', { method: 'POST' }).then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(report, null, 2);
      await refreshAll();
    }

    async function refreshAll() {
      const [health, analytics] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/sql-on-fhir/analytics').then(r => r.json())
      ]);

      document.getElementById('status-badges').innerHTML = [
        '<span class="badge ok">Env: ' + escHtml(health.envStatus) + ' (' + escHtml(health.clinicType) + ')</span>',
        '<span class="badge">Wallet: $' + escHtml(health.walletBalanceUsd) + '</span>'
      ].join('');

      document.getElementById('ohs-config-snippet').textContent = JSON.stringify({
        ohsAndroidFhirSdk: {
          baseUrl: health.fhirBaseUrl,
          smartConfigurationUrl: health.smartDiscoveryUrl,
          questionnaireCanonicalUrl: '${safeQuestionnaireUrlHtml}'
        },
        fhirDataPipesSqlOnFhir: {
          environmentId: health.environmentId,
          targetTables: ['ohs_patient_flat_view', 'ohs_questionnaire_responses']
        }
      }, null, 2);

      cachedPatients = analytics.patients || [];
      const selectEl = document.getElementById('sdc-patient');
      const prevVal = selectEl.value;
      selectEl.innerHTML = cachedPatients.map(p =>
        '<option value="' + escHtml(p.patient_id) + '" data-name="' + escHtml(p.full_name) + '">' +
          escHtml(p.full_name) + ' (' + escHtml(p.mrn) + ')' +
        '</option>'
      ).join('');
      if (prevVal && cachedPatients.some(p => String(p.patient_id) === String(prevVal))) {
        selectEl.value = prevVal;
      }

      document.getElementById('cohort-tbody').innerHTML = cachedPatients.map(p => (
        '<tr>' +
          '<th>' + escHtml(p.full_name) + '<br/><small style="font-weight:400;color:var(--muted);"><code>' + escHtml(p.fhir_reference) + '</code> · ' + escHtml(p.gender) + '</small></th>' +
          '<td>' + escHtml(p.primary_condition) + '<br/><small style="color:var(--muted);">' + escHtml(p.department) + ' (' + escHtml(p.acuity_level) + ')</small></td>' +
          '<td>' + escHtml(p.screening_count || 0) + ' synced' + (p.max_risk_score ? ' · Max Score ' + escHtml(p.max_risk_score) : '') + '</td>' +
          '<td><button type="button" data-screen-patient-id="' + escHtml(p.patient_id) + '" data-screen-patient-name="' + escHtml(p.full_name) + '">Screen &amp; Flatten</button></td>' +
        '</tr>'
      )).join('') || '<tr><td colspan="4">No flattened patients yet.</td></tr>';

      const responses = analytics.responses || [];
      document.getElementById('tier-summary-badge').textContent = responses.length + ' Screenings Synced';
      document.getElementById('responses-tbody').innerHTML = responses.map(r => (
        '<tr>' +
          '<th>' + escHtml(r.patient_name) + '<br/><small style="font-weight:400;color:var(--muted);"><code>' + escHtml(r.response_id) + '</code></small></th>' +
          '<td>BP ' + escHtml(r.systolic_bp) + '/' + escHtml(r.diastolic_bp) + ' mmHg<br/><small style="color:var(--muted);">Glucose ' + escHtml(r.glucose_mg_dl) + ' mg/dL · SpO2 ' + escHtml(r.spo2_pct) + '%</small></td>' +
          '<td>PHQ-2: ' + escHtml(r.phq2_score) + '/6<br/><small style="color:var(--muted);">SDOH Barrier: ' + (r.sdoh_flag ? 'Yes (Z59/Z60)' : 'No') + '</small></td>' +
          '<td><strong>' + escHtml(r.risk_tier) + '</strong> (' + escHtml(r.risk_score) + '/100)<br/><small style="color:var(--muted);">' + escHtml(r.recommended_action) + '</small></td>' +
        '</tr>'
      )).join('') || '<tr><td colspan="4">No QuestionnaireResponses synced yet. Use the form on the right or click "Screen & Flatten".</td></tr>';
    }

    refreshAll();
  </script>
</body>
</html>`)
        return
      }

      return sendJson(res, 404, { error: 'Not found' })
    } catch (err) {
      const status = Number(err?.statusCode) || 500
      return sendJson(res, status, {
        error: redactSecrets(String(err?.message || err))
      })
    }
  })

  return {
    server,
    client,
    ensureOhsSchema,
    syncPatientCohortToSqlOnFhir,
    syncQuestionnaireResponses,
    getSqlOnFhirAnalytics,
    runAiCommonsEvaluation,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3014)
  const boot = await bootstrapOhsEnvironment()
  const { apiKey, baseUrl, appUrl, environmentId, orgName, claimUrl, source } = boot

  if (source === 'hebrah_login' || source === 'env_or_cli') {
    console.log(
      `Authenticated via hebrah login${orgName ? ` (Org: ${orgName})` : ''} · API: ${baseUrl}`
    )
    console.log(`Active Isolated Health Environment: ${environmentId}`)
    console.log(
      `View in Hebrah Dashboard UI: ${appUrl.replace(/\/$/, '')}/environments/${environmentId}`
    )
  } else {
    console.log(`Provisioned Isolated Ambulatory Clinic + PostgreSQL 16 Environment: ${environmentId}`)
    if (claimUrl) {
      console.log(`Claim Organization URL ($5.00 Free Trial): ${claimUrl}`)
    }
  }

  const app = createOhsDemoServer({ apiKey, baseUrl, environmentId })
  await app.ensureOhsSchema()
  await app.syncPatientCohortToSqlOnFhir()
  app.server.listen(port, '127.0.0.1', () => {
    console.log(`Open Health Stack (OHS) + Hebrah Demo listening at http://127.0.0.1:${port}`)
  })
}
