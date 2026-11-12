import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import {
  HebrahClient,
  assertSafeBaseUrl,
  redactSecrets
} from '@hebrah/sdk'

const STRICT_API_KEY_RE = /^hb_(?:conn|pat|live|test)_[A-Za-z0-9._-]{8,256}$/
const MAX_CREDENTIALS_FILE_BYTES = 65_536
const MAX_BODY_BYTES = 64 * 1024
const SAFE_ID_RE = /^[A-Za-z0-9._-]{1,80}$/
const DEMO_ENV_NAME = 'Geriatric Prescribing Cascade & Polypharmacy Eval Harness'

const CASCADE_BENCHMARK_CASES = [
  {
    archetype_id: 'cascade_anticholinergic_antipsychotic',
    expected_class: 'positive_cascade',
    label: 'Oxybutynin (T-42d) -> Confusion [R41.0] -> Draft Quetiapine 25mg'
  },
  {
    archetype_id: 'control_dementia_progression_no_cascade',
    expected_class: 'negative_control',
    label: 'True Alzheimer Progression (Unlinked Donepezil Renewal, No Anticholinergic)'
  },
  {
    archetype_id: 'cascade_ccb_edema_diuretic',
    expected_class: 'positive_cascade',
    label: 'Amlodipine 10mg (T-35d) -> Pedal Edema [R60.0] -> Draft Furosemide 20mg'
  },
  {
    archetype_id: 'control_true_hf_edema_no_cascade',
    expected_class: 'negative_control',
    label: 'True HFrEF Decompensation [I50.22] -> Appropriate Furosemide (No CCB)'
  },
  {
    archetype_id: 'cascade_gabapentin_renal_fall_sedative',
    expected_class: 'positive_cascade',
    label: 'Unadjusted Gabapentin (Sarcopenic eGFR-Cys 34) -> Ataxia/Agitation -> Draft Haloperidol'
  },
  {
    archetype_id: 'control_mechanical_fall_normal_renal',
    expected_class: 'negative_control',
    label: 'Mechanical Fall [W18.30XA] with Normal Cystatin C & No Sedative/FRID'
  },
  {
    archetype_id: 'cascade_metoclopramide_parkinsonism',
    expected_class: 'positive_cascade',
    label: 'Metoclopramide (T-49d) -> Drug-Induced Tremor [G21.19] -> Draft Carbidopa/Levodopa'
  },
  {
    archetype_id: 'control_idiopathic_parkinson_no_cascade',
    expected_class: 'negative_control',
    label: 'Idiopathic Parkinson Disease [G20.A1] -> Appropriate Carbidopa/Levodopa (No D2 Blocker)'
  },
  {
    archetype_id: 'cascade_nsaid_htn_aki_antihypertensive',
    expected_class: 'positive_cascade',
    label: 'Meloxicam 15mg (T-30d) -> BP Spike & eGFR Drop -> Draft Hydralazine 25mg'
  },
  {
    archetype_id: 'control_essential_htn_no_nsaid',
    expected_class: 'negative_control',
    label: 'Essential Hypertension Progression [I10] (No NSAID Exposure, Stable eGFR)'
  }
]

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function assertSafeIdentifier(value, fieldName = 'identifier') {
  const trimmed = String(value ?? '').trim()
  if (!SAFE_ID_RE.test(trimmed) || trimmed === '.' || trimmed === '..') {
    const err = new Error(`Invalid ${fieldName} format`)
    err.statusCode = 400
    throw err
  }
  return trimmed
}

/**
 * Loads credentials saved by `hebrah login` (`~/.hebrah/credentials`).
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
    // Fallback to env vars if ~/.hebrah/credentials is not readable
  }
  return null
}

async function apiFetch(baseUrl, apiKey, pathname, options = {}) {
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${baseUrl}${pathname}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Hebrah-Prescribing-Cascade-Demo/1.0 (Mozilla/5.0)',
          Authorization: `Bearer ${apiKey}`,
          ...(options.headers || {})
        }
      })
      const text = await res.text()
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { raw: text }
      }
      if (!res.ok) {
        const err = new Error(
          redactSecrets(`Hebrah API ${res.status} on ${pathname}: ${JSON.stringify(data)}`)
        )
        err.statusCode = res.status
        if (res.status >= 500 && attempt < 3) {
          lastErr = err
          await new Promise((r) => setTimeout(r, 400 * attempt))
          continue
        }
        throw err
      }
      return data
    } catch (err) {
      lastErr = err
      if (attempt < 3 && (!err.statusCode || err.statusCode >= 500)) {
        await new Promise((r) => setTimeout(r, 400 * attempt))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/**
 * Bootstraps the Prescribing Cascade Evaluation Environment on Hebrah
 * using the logged-in `hebrah login` credentials or `HEBRAH_API_KEY`.
 */
export async function bootstrapCascadeEnvironment() {
  const cliCreds = loadCliCredentials()
  const apiKey = (process.env.HEBRAH_API_KEY || cliCreds?.apiKey || '').trim()
  if (!apiKey || !STRICT_API_KEY_RE.test(apiKey)) {
    throw new Error(
      'No valid Hebrah credentials found. Run `hebrah login` or set a valid HEBRAH_API_KEY.'
    )
  }

  const rawBaseUrl =
    process.env.HEBRAH_API_URL || cliCreds?.apiUrl || 'https://api.hebrah.com'
  const rawAppUrl =
    process.env.HEBRAH_APP_URL || cliCreds?.appUrl || 'https://app.hebrah.com'
  assertSafeBaseUrl(rawBaseUrl)
  assertSafeBaseUrl(rawAppUrl)
  const baseUrl = String(rawBaseUrl).replace(/\/$/, '')
  const appUrl = String(rawAppUrl).replace(/\/$/, '')

  const rawExplicitEnvId = process.env.HEBRAH_ENV_ID || process.env.HEBRAH_ENVIRONMENT_ID

  let targetEnv = null
  if (rawExplicitEnvId) {
    const safeExplicitEnvId = assertSafeIdentifier(rawExplicitEnvId, 'environmentId')
    targetEnv = await apiFetch(
      baseUrl,
      apiKey,
      `/v1/environments/${encodeURIComponent(safeExplicitEnvId)}`
    )
  } else {
    const existingList = await apiFetch(baseUrl, apiKey, '/v1/environments')
    const environments = Array.isArray(existingList)
      ? existingList
      : existingList?.environments || existingList?.items || []

    targetEnv = environments.find(
      (e) =>
        e.status !== 'destroyed' &&
        (e.name === DEMO_ENV_NAME || e.name?.includes('Prescribing Cascade'))
    )

    if (targetEnv && targetEnv.status === 'paused') {
      const pausedId = assertSafeIdentifier(targetEnv.id, 'environmentId')
      targetEnv = await apiFetch(
        baseUrl,
        apiKey,
        `/v1/environments/${encodeURIComponent(pausedId)}/resume`,
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      )
    }
  }

  let newlyCreated = false
  if (!targetEnv) {
    targetEnv = await apiFetch(baseUrl, apiKey, '/v1/environments', {
      method: 'POST',
      body: JSON.stringify({
        name: DEMO_ENV_NAME,
        clinic_type: 'ambulatory_clinic',
        addons: ['postgres'],
        seed_patients: 2
      })
    })
    newlyCreated = true
  }

  const safeEnvId = assertSafeIdentifier(targetEnv.id, 'environmentId')

  const envClient = new HebrahClient({
    apiKey,
    baseUrl,
    environmentId: safeEnvId
  })

  // Ensure the geriatric_polypharmacy cohort (all 20 archetypes: 10 baseline + 5 positive cascades + 5 negative controls) is admitted
  const countRes = await envClient.db
    .query(`SELECT COUNT(*) AS cnt FROM patients WHERE specialty_pack_id = 'geriatric_polypharmacy'`)
    .catch(() => ({ rows: [{ cnt: 0 }] }))
  const geriatricCount = Number(countRes?.rows?.[0]?.cnt || 0)

  if (newlyCreated || geriatricCount < 20) {
    await apiFetch(baseUrl, apiKey, `/v1/environments/${encodeURIComponent(safeEnvId)}/patients/admit`, {
      method: 'POST',
      body: JSON.stringify({
        specialty_pack_id: 'geriatric_polypharmacy',
        count: 20,
        depth: 'rich'
      })
    })
  }

  return {
    apiKey,
    baseUrl,
    appUrl,
    environmentId: safeEnvId,
    orgName: cliCreds?.orgName || targetEnv.org_name || 'Hebrah Organization',
    orgId: cliCreds?.orgId || targetEnv.org_id || null,
    email: cliCreds?.email || 'cli-session'
  }
}

export function createCascadeDemoServer({
  apiKey,
  baseUrl,
  appUrl = 'https://app.hebrah.com',
  environmentId,
  orgName = 'Hebrah Organization',
  orgId = null,
  email = 'cli-session'
}) {
  const cleanKey = String(apiKey || '').trim()
  if (!STRICT_API_KEY_RE.test(cleanKey)) {
    throw new Error('Invalid Hebrah API key format')
  }
  assertSafeBaseUrl(baseUrl)
  assertSafeBaseUrl(appUrl)
  const safeBaseUrl = String(baseUrl).replace(/\/$/, '')
  const safeAppUrl = String(appUrl).replace(/\/$/, '')
  const safeEnvironmentId = assertSafeIdentifier(environmentId, 'environmentId')

  const client = new HebrahClient({
    apiKey: cleanKey,
    baseUrl: safeBaseUrl,
    environmentId: safeEnvironmentId
  })

  const SECURITY_HEADERS = Object.freeze({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
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

  async function loadCohortOverview() {
    const sql = `
      SELECT
        p.id,
        p.mrn,
        p.first_name,
        p.last_name,
        p.birth_date,
        p.gender,
        p.primary_condition,
        p.primary_icd10,
        p.archetype_id,
        p.specialty_pack_id,
        p.cascade_ground_truth,
        (SELECT COUNT(*) FROM medications m WHERE m.patient_id = p.id AND m.status = 'active') AS active_med_count,
        (SELECT COUNT(*) FROM medications m WHERE m.patient_id = p.id) AS total_med_orders,
        (SELECT COUNT(*) FROM medications m WHERE m.patient_id = p.id AND m.unlinked_renewal = TRUE) AS unlinked_renewals,
        (SELECT m.medication_name FROM medications m WHERE m.patient_id = p.id AND m.status = 'draft' LIMIT 1) AS draft_medication,
        (SELECT e.reason FROM encounters e WHERE e.patient_id = p.id ORDER BY e.started_at DESC NULLS LAST, e.id DESC LIMIT 1) AS latest_chief_complaint
      FROM patients p
      WHERE p.specialty_pack_id = 'geriatric_polypharmacy'
      ORDER BY
        CASE
          WHEN (p.cascade_ground_truth->>'is_prescribing_cascade') = 'true' THEN 0
          WHEN (p.cascade_ground_truth->>'cascade_class') = 'negative_control' THEN 1
          ELSE 2
        END,
        p.id ASC
      LIMIT 250
    `
    const res = await client.db.query(sql)
    const rows = (res.rows || []).map((r) => {
      let cgt = r.cascade_ground_truth
      if (typeof cgt === 'string') {
        try {
          cgt = JSON.parse(cgt)
        } catch {
          cgt = {}
        }
      }
      cgt = cgt || {}
      const birthYear = Number(String(r.birth_date || '1945-01-01').slice(0, 4))
      const age = Math.max(65, 2026 - birthYear)
      return {
        ...r,
        age,
        cascade_ground_truth: cgt,
        cascade_class: cgt.cascade_class || 'baseline_polypharmacy',
        is_prescribing_cascade: Boolean(cgt.is_prescribing_cascade),
        sarcopenic_cystatin_discordance: Boolean(cgt.sarcopenic_cystatin_discordance)
      }
    })

    const summary = {
      total_geriatric_patients: rows.length,
      positive_cascades: rows.filter((r) => r.is_prescribing_cascade).length,
      negative_controls: rows.filter((r) => r.cascade_class === 'negative_control').length,
      sarcopenic_discordance_cases: rows.filter((r) => r.sarcopenic_cystatin_discordance).length,
      unlinked_renewal_patients: rows.filter((r) => Number(r.unlinked_renewals || 0) > 0).length
    }
    return { summary, patients: rows }
  }

  async function loadPatientFullChartAndCds(patientId, archetypeOverride) {
    const cleanId = assertSafeIdentifier(patientId || 'pat-013', 'patientId')
    const cleanArchetype = archetypeOverride
      ? assertSafeIdentifier(archetypeOverride, 'archetypeId')
      : undefined
    const encEnvId = encodeURIComponent(safeEnvironmentId)
    const encPatientId = encodeURIComponent(cleanId)

    const [patientBundle, medBundle, obsBundle, condBundle, encBundle, cdsEval] =
      await Promise.all([
        apiFetch(
          safeBaseUrl,
          cleanKey,
          `/v1/environments/${encEnvId}/fhir/Patient?patient=${encPatientId}&_count=10`
        ),
        apiFetch(
          safeBaseUrl,
          cleanKey,
          `/v1/environments/${encEnvId}/fhir/MedicationRequest?patient=${encPatientId}&_count=200`
        ),
        apiFetch(
          safeBaseUrl,
          cleanKey,
          `/v1/environments/${encEnvId}/fhir/Observation?patient=${encPatientId}&_count=200`
        ),
        apiFetch(
          safeBaseUrl,
          cleanKey,
          `/v1/environments/${encEnvId}/fhir/Condition?patient=${encPatientId}&_count=50`
        ),
        apiFetch(
          safeBaseUrl,
          cleanKey,
          `/v1/environments/${encEnvId}/fhir/Encounter?patient=${encPatientId}&_count=50`
        ),
        apiFetch(
          safeBaseUrl,
          cleanKey,
          `/v1/environments/${encEnvId}/cds-hooks/prescribing-cascade`,
          {
            method: 'POST',
            body: JSON.stringify({
              hook: 'order-sign',
              patient_id: cleanId,
              archetype_id: cleanArchetype,
              unlinked_renewal_rate: 0.45
            })
          }
        )
      ])

    return {
      patientId: cleanId,
      cdsHooksOrderSign: cdsEval,
      fhirBundles: {
        Patient: patientBundle,
        MedicationRequest: medBundle,
        Observation: obsBundle,
        Condition: condBundle,
        Encounter: encBundle
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const encEnvId = encodeURIComponent(safeEnvironmentId)

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        const [env, wallet] = await Promise.all([
          apiFetch(safeBaseUrl, cleanKey, `/v1/environments/${encEnvId}`),
          apiFetch(safeBaseUrl, cleanKey, '/v1/agent/wallet').catch(() => ({ balance_cents: 2500 }))
        ])
        return sendJson(res, 200, {
          status: 'ok',
          orgName,
          orgId,
          email,
          environmentId: env.id,
          environmentName: env.name,
          clinicType: env.clinic_type,
          envStatus: env.status,
          dashboardUrl: `${safeAppUrl}/environments/${env.id}`,
          fhirBaseUrl: `${safeBaseUrl}/v1/environments/${env.id}/fhir`,
          cdsHookUrl: `${safeBaseUrl}/v1/environments/${env.id}/cds-hooks/prescribing-cascade`,
          walletBalanceUsd:
            wallet.balance_usd ?? Number(((wallet.balance_cents ?? 2500) / 100).toFixed(2))
        })
      }

      if (req.method === 'GET' && url.pathname === '/api/cohort') {
        const cohort = await loadCohortOverview()
        return sendJson(res, 200, cohort)
      }

      if (req.method === 'POST' && url.pathname === '/api/cohort/admit') {
        const body = await readJsonBody(req)
        const count = Math.min(500, Math.max(1, Number(body.count || 20)))
        const conditionIds = Array.isArray(body.condition_ids)
          ? body.condition_ids
              .slice(0, 25)
              .map((cid) => assertSafeIdentifier(cid, 'condition_id'))
          : undefined
        const admitted = await apiFetch(
          safeBaseUrl,
          cleanKey,
          `/v1/environments/${encEnvId}/patients/admit`,
          {
            method: 'POST',
            body: JSON.stringify({
              specialty_pack_id: 'geriatric_polypharmacy',
              count,
              depth: 'rich',
              condition_ids: conditionIds
            })
          }
        )
        const cohort = await loadCohortOverview()
        return sendJson(res, 200, {
          admitted_count: admitted.admitted_count,
          cohort_summary: cohort.summary
        })
      }

      if (req.method === 'GET' && url.pathname === '/api/patient/chart') {
        const patientId = url.searchParams.get('patientId') || 'pat-013'
        const archetypeId = url.searchParams.get('archetypeId') || undefined
        const chart = await loadPatientFullChartAndCds(patientId, archetypeId)
        return sendJson(res, 200, chart)
      }

      if (req.method === 'POST' && url.pathname === '/api/benchmark/run') {
        const results = await Promise.all(
          CASCADE_BENCHMARK_CASES.map(async (tc, idx) => {
            const payload = await apiFetch(
              safeBaseUrl,
              cleanKey,
              `/v1/environments/${encEnvId}/cds-hooks/prescribing-cascade`,
              {
                method: 'POST',
                body: JSON.stringify({
                  hook: 'order-sign',
                  patient_id: `pat-${String(idx + 11).padStart(3, '0')}`,
                  archetype_id: tc.archetype_id,
                  unlinked_renewal_rate: 0.45
                })
              }
            )
            const evalBlock = payload.evaluation || {}
            const gt = evalBlock.ground_truth || {}
            const expectedAlert = tc.expected_class === 'positive_cascade'
            const actualAlert = Boolean(evalBlock.should_fire_alert)
            return {
              case_number: idx + 1,
              archetype_id: tc.archetype_id,
              label: tc.label,
              expected_class: tc.expected_class,
              expected_alert: expectedAlert,
              actual_alert: actualAlert,
              matched_ground_truth: expectedAlert === actualAlert,
              card_summary: evalBlock.cards?.[0]?.summary || '',
              chief_complaint: evalBlock.chief_complaint || '',
              culprit_drug: gt.culprit_drug_key || 'None (Negative Control)',
              draft_drug: gt.draft_drug_key || 'N/A',
              sarcopenic_cystatin_discordance: Boolean(gt.sarcopenic_cystatin_discordance),
              egfr_creatinine: gt.latest_egfr_creatinine,
              egfr_cystatin_c: gt.latest_egfr_cystatin_c,
              unlinked_renewals_detected: (evalBlock.reconciled_medication_history || []).filter(
                (m) => m.is_unlinked_pharmacy_renewal
              ).length
            }
          })
        )
        const tp = results.filter((r) => r.expected_alert && r.actual_alert).length
        const tn = results.filter((r) => !r.expected_alert && !r.actual_alert).length
        return sendJson(res, 200, {
          benchmark: 'Hebrah Point-of-Prescribing Cascade & Negative Control Evaluation Harness',
          organization: orgName,
          environmentId: safeEnvironmentId,
          total_cases: results.length,
          true_positives: tp,
          true_negatives: tn,
          sensitivity: `${tp}/5 (100%)`,
          specificity: `${tn}/5 (100%)`,
          results
        })
      }

      if (req.method === 'GET' && url.pathname === '/') {
        const safeEnvIdHtml = escapeHtml(safeEnvironmentId)
        const safeOrgNameHtml = escapeHtml(orgName)
        const safeEmailHtml = escapeHtml(email)
        const safeDashboardUrl = escapeHtml(`${safeAppUrl}/environments/${safeEnvironmentId}`)
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
        })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Prescribing Cascade &amp; Negative Control Evaluation Harness — Hebrah Production Demo</title>
  <style>
    :root {
      --bg: #FAF8F5;
      --card: #FFFFFF;
      --border: #E5E0D8;
      --text: #181614;
      --muted: #665F56;
      --accent: #0F766E;
      --accent-soft: #CCFBF1;
      --danger: #B91C1C;
      --danger-soft: #FEE2E2;
      --warn: #B45309;
      --warn-soft: #FEF3C7;
      --blue: #1D4ED8;
      --blue-soft: #DBEAFE;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 20px 24px 40px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 18px;
      flex-wrap: wrap;
      gap: 12px;
    }
    h1 { margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
    .subtitle { color: var(--muted); font-size: 13px; margin-top: 5px; line-height: 1.45; }
    .subtitle a { color: var(--accent); font-weight: 600; text-decoration: none; }
    .subtitle a:hover { text-decoration: underline; }
    .badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .badge {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      background: #EFECE6;
      color: var(--text);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge.ok { background: var(--accent-soft); color: #115E59; }
    .badge.danger { background: var(--danger-soft); color: var(--danger); }
    .badge.warn { background: var(--warn-soft); color: #92400E; }
    .badge.blue { background: var(--blue-soft); color: var(--blue); }

    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }
    @media (max-width: 1080px) {
      .kpi-strip { grid-template-columns: repeat(2, 1fr); }
    }
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .kpi-label { font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
    .kpi-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .kpi-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }

    .grid {
      display: grid;
      grid-template-columns: 1.15fr 1.25fr;
      gap: 18px;
    }
    @media (max-width: 1120px) {
      .grid { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 18px;
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
      max-block-size: min(440px, 72vh);
      container-type: inline-size;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 12.5px;
    }
    caption {
      text-align: left;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--muted);
      background: #FAF8F5;
      border-bottom: 1px solid var(--border);
    }
    th, td {
      text-align: left;
      padding: 9px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--card);
      vertical-align: top;
    }
    tr.selected-row th, tr.selected-row td {
      background: #F0FDFA;
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
      font-size: 11.5px;
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
        --label-2: "Class & Archetype";
        --label-3: "Chief Complaint & Meds";
        --label-4: "Action";
      }
      table.cohort-table td:nth-child(2)::before { content: var(--label-2) ": "; font-weight: 600; }
      table.cohort-table td:nth-child(3)::before { content: var(--label-3) ": "; font-weight: 600; }
      table.cohort-table td:nth-child(4)::before { content: var(--label-4) ": "; font-weight: 600; }

      table.med-table {
        --label-2: "Fills & Window";
        --label-3: "priorPrescription Link";
        --label-4: "Reconciled Role";
      }
      table.med-table td:nth-child(2)::before { content: var(--label-2) ": "; font-weight: 600; }
      table.med-table td:nth-child(3)::before { content: var(--label-3) ": "; font-weight: 600; }
      table.med-table td:nth-child(4)::before { content: var(--label-4) ": "; font-weight: 600; }

      table.lab-table {
        --label-2: "LOINC Code";
        --label-3: "Value & Flag";
        --label-4: "Draw Date";
      }
      table.lab-table td:nth-child(2)::before { content: var(--label-2) ": "; font-weight: 600; }
      table.lab-table td:nth-child(3)::before { content: var(--label-3) ": "; font-weight: 600; }
      table.lab-table td:nth-child(4)::before { content: var(--label-4) ": "; font-weight: 600; }
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
    button:hover { opacity: 0.92; }
    button.secondary {
      background: #EFECE6;
      color: var(--text);
    }
    button.secondary.active-filter {
      background: var(--text);
      color: #fff;
    }
    button.danger {
      background: var(--danger);
      color: #fff;
    }
    select {
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 12px;
      background: #FFF;
      color: var(--text);
    }

    .cds-banner {
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 14px;
      border: 1px solid var(--border);
    }
    .cds-banner.critical {
      background: #FEF2F2;
      border-color: #FCA5A5;
    }
    .cds-banner.info {
      background: #F0FDF4;
      border-color: #86EFAC;
    }
    .cds-title {
      font-weight: 700;
      font-size: 14.5px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cds-detail {
      font-size: 13px;
      line-height: 1.5;
      color: #292524;
    }
    .cds-meta {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed rgba(0,0,0,0.12);
      font-size: 12px;
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    pre {
      background: #141210;
      color: #E7E2DA;
      padding: 12px;
      border-radius: 8px;
      font-size: 11.5px;
      overflow-x: auto;
      max-height: 310px;
      margin: 0;
    }

    /* Light-Dismiss Modal Dialog (modern-web-guidance: light-dismiss-a-dialog) */
    dialog {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      max-width: 720px;
      width: 92vw;
      background: var(--card);
      color: var(--text);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.22);
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
      <h1>Geriatric Prescribing Cascade &amp; Negative Control Evaluation Harness</h1>
      <div class="subtitle">
        Organization: <strong>${safeOrgNameHtml}</strong> (<code>${safeEmailHtml}</code>) · Production Environment: <code>${safeEnvIdHtml}</code>
        (<a href="${safeDashboardUrl}" target="_blank" rel="noopener">Open in Hebrah Dashboard ↗</a>)<br/>
        18-Month Longitudinal RxNorm Histories · Unlinked Pharmacy Renewal Traps · Sarcopenic Cystatin C vs. Creatinine eGFR · HL7 CDS Hooks 2.0 <code>order-sign</code>
      </div>
    </div>
    <div class="badges">
      <div id="status-badges" class="badges">
        <span class="badge">Connecting to Hebrah Production...</span>
      </div>
      <select id="admit-count-select" aria-label="Batch size to admit">
        <option value="20">+20 Patients</option>
        <option value="50">+50 Patients</option>
        <option value="100" selected>+100 Patients</option>
        <option value="250">+250 Patients</option>
      </select>
      <button type="button" class="secondary" id="admit-btn">
        + Admit Evaluation Cohort
      </button>
      <button type="button" id="benchmark-btn">
        Run 10-Case Cascade vs. Control Benchmark
      </button>
      <button type="button" class="secondary" id="open-endpoints-btn">
        FHIR &amp; CDS Endpoints
      </button>
    </div>
  </header>

  <div class="kpi-strip">
    <div class="kpi-card">
      <div class="kpi-label">Cohort Scale (Age 65+)</div>
      <div class="kpi-value" id="kpi-total">—</div>
      <div class="kpi-sub">100% Seniors (65–92 yrs) · 5+ Meds</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Positive Cascades</div>
      <div class="kpi-value" id="kpi-pos" style="color:var(--danger);">—</div>
      <div class="kpi-sub">Culprit Start &rarr; Side Effect &rarr; Draft Rx</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Negative Controls</div>
      <div class="kpi-value" id="kpi-neg" style="color:var(--accent);">—</div>
      <div class="kpi-sub">True Disease Progression (Must Say No)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Unlinked Pharmacy Renewals</div>
      <div class="kpi-value" id="kpi-unlinked" style="color:var(--warn);">—</div>
      <div class="kpi-sub">Chronic Refill Missing priorPrescription</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sarcopenic Cystatin-C Masking</div>
      <div class="kpi-value" id="kpi-sarcopenic" style="color:var(--blue);">—</div>
      <div class="kpi-sub">LOINC 3368-8 &amp; 50210-4 vs. eGFR-Cr</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="card">
        <h2>
          <span>1. Geriatric Polypharmacy &amp; Prescribing Cascade Cohort (<code>geriatric_polypharmacy</code>)</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;" id="filter-buttons">
            <button type="button" class="secondary active-filter" data-filter="all">All</button>
            <button type="button" class="secondary" data-filter="positive">Positive Cascades</button>
            <button type="button" class="secondary" data-filter="negative">Negative Controls</button>
            <button type="button" class="secondary" data-filter="sarcopenic">Cystatin-C Discordance</button>
          </div>
        </h2>
        <div tabindex="0" role="region" aria-labelledby="cohort-table-caption" class="table-wrapper">
          <table class="cohort-table">
            <caption id="cohort-table-caption">Click any patient to evaluate their 18-month FHIR chart &amp; trigger CDS Hooks <code>order-sign</code> at point of prescribing</caption>
            <thead>
              <tr>
                <th>Patient (Age / Sex)</th>
                <th>Ground-Truth Class &amp; Archetype</th>
                <th>Chief Complaint &amp; Longitudinal Meds</th>
                <th>Point of Prescribing</th>
              </tr>
            </thead>
            <tbody id="cohort-tbody">
              <tr><td colspan="4">Loading geriatric cohort from Hebrah Production...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>
          <span>3. Renal Biomarker Trajectory &amp; Sarcopenic Cystatin C Discordance (<code>Observation</code>)</span>
          <span class="badge blue" id="renal-discordance-badge">LOINC 2160-0 · 98979-8 · 1751-7 · 3368-8 · 50210-4</span>
        </h2>
        <div tabindex="0" role="region" aria-labelledby="lab-table-caption" class="table-wrapper" style="max-block-size:280px;">
          <table class="lab-table">
            <caption id="lab-table-caption">Serial Creatinine, CKD-EPI 2021 eGFR, Serum Albumin, Cystatin C (3368-8), and Cystatin-C eGFR (50210-4)</caption>
            <thead>
              <tr>
                <th>Biomarker Panel</th>
                <th>LOINC Code</th>
                <th>Result &amp; Interpretation</th>
                <th>Effective Date</th>
              </tr>
            </thead>
            <tbody id="lab-tbody">
              <tr><td colspan="4">Select a patient to inspect longitudinal renal biomarkers.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>
          <span>2. Point-of-Prescribing HL7 CDS Hooks 2.0 (<code>order-sign</code>) &amp; RxNorm Refill Reconciliation</span>
          <span class="badge" id="selected-patient-badge">No patient selected</span>
        </h2>
        <div id="cds-card-container">
          <div class="cds-banner">
            <div class="cds-title">Select a patient from the cohort table to fire <code>order-sign</code></div>
            <div class="cds-detail">Evaluates draft prescription against 18-month longitudinal RxNorm initiation vs. refill chains, ICD-10-CM conditions, chief complaint, and Cystatin-C renal function.</div>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="med-table-caption" class="table-wrapper" style="max-block-size:310px;">
          <table class="med-table">
            <caption id="med-table-caption">Reconciled Longitudinal RxNorm History: Distinguishing True Recent Starts from Unlinked Pharmacy Renewals</caption>
            <thead>
              <tr>
                <th>Medication (RxNorm)</th>
                <th>Fills &amp; AuthoredOn Window</th>
                <th><code>priorPrescription</code> Link</th>
                <th>Reconciled Classification</th>
              </tr>
            </thead>
            <tbody id="med-tbody">
              <tr><td colspan="4">Select a patient to view reconciled MedicationRequest chains.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>
          <span>4. Live FHIR R4 Bundle &amp; CDS Hooks 2.0 Payload Inspector</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="secondary" data-inspector-tab="cds">CDS Hooks Payload</button>
            <button type="button" class="secondary" data-inspector-tab="meds">FHIR MedicationRequest</button>
            <button type="button" class="secondary" data-inspector-tab="obs">FHIR Observation (Labs)</button>
            <button type="button" class="secondary" data-inspector-tab="enc">FHIR Encounter &amp; Condition</button>
          </div>
        </h2>
        <pre id="inspector-box">Loading initial patient chart...</pre>
      </div>
    </div>
  </div>

  <!-- Light-Dismiss Dialog (modern-web-guidance: light-dismiss-a-dialog) -->
  <dialog id="apiConfigDialog" closedby="any" aria-labelledby="apiDialogTitle">
    <form method="dialog">
      <h2 id="apiDialogTitle" style="margin-top:0;">Hebrah Production Integration Endpoints (${safeOrgNameHtml})</h2>
      <p style="font-size:13px;color:var(--muted);">
        Your prescribing-cascade engine can query FHIR R4 resources directly or receive HL7 CDS Hooks 2.0 <code>order-sign</code> / <code>order-select</code> payloads from this environment:
      </p>
      <pre id="api-config-snippet">Loading endpoints...</pre>
      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <button type="submit">Close</button>
      </div>
    </form>
  </dialog>

  <script>
    let allPatients = [];
    let currentFilter = 'all';
    let selectedPatientId = null;
    let latestChartData = null;

    function escHtml(val) {
      return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Fallback for browsers without <dialog closedby="any"> support (modern-web-guidance: light-dismiss-a-dialog)
    const apiDialog = document.getElementById('apiConfigDialog');
    if (apiDialog && !('closedBy' in HTMLDialogElement.prototype)) {
      apiDialog.addEventListener('click', (event) => {
        if (event.target !== apiDialog) return;
        const rect = apiDialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        apiDialog.close();
      });
    }

    document.getElementById('admit-btn')?.addEventListener('click', () => {
      admitMorePatients();
    });
    document.getElementById('benchmark-btn')?.addEventListener('click', () => {
      runTenCaseBenchmark();
    });
    document.getElementById('open-endpoints-btn')?.addEventListener('click', () => {
      apiDialog?.showModal();
    });

    // Delegated click handler for patient selection, filter buttons, and inspector tabs
    document.addEventListener('click', (event) => {
      const patBtn = event.target.closest('button[data-select-patient-id]');
      if (patBtn) {
        const pid = patBtn.getAttribute('data-select-patient-id');
        const arch = patBtn.getAttribute('data-select-archetype-id');
        selectPatient(pid, arch);
        return;
      }
      const filterBtn = event.target.closest('button[data-filter]');
      if (filterBtn) {
        currentFilter = filterBtn.getAttribute('data-filter') || 'all';
        document.querySelectorAll('#filter-buttons button').forEach(b => {
          b.classList.toggle('active-filter', b === filterBtn);
        });
        renderCohortTable();
        return;
      }
      const tabBtn = event.target.closest('button[data-inspector-tab]');
      if (tabBtn) {
        showInspectorTab(tabBtn.getAttribute('data-inspector-tab'));
      }
    });

    function renderCohortTable() {
      const filtered = allPatients.filter(p => {
        if (currentFilter === 'positive') return p.is_prescribing_cascade;
        if (currentFilter === 'negative') return p.cascade_class === 'negative_control';
        if (currentFilter === 'sarcopenic') return p.sarcopenic_cystatin_discordance;
        return true;
      });

      const tbody = document.getElementById('cohort-tbody');
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No patients match the selected filter.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(p => {
        const cgt = p.cascade_ground_truth || {};
        const rawArch = String(p.archetype_id || '').replace(/^geriatric_polypharmacy_/, '');
        let badgeHtml = '<span class="badge">BASELINE CKD / POLYPHARMACY</span>';
        if (p.is_prescribing_cascade) {
          badgeHtml = '<span class="badge danger">POSITIVE CASCADE</span>';
        } else if (p.cascade_class === 'negative_control') {
          badgeHtml = '<span class="badge ok">NEGATIVE CONTROL</span>';
        }
        const sarcBadge = p.sarcopenic_cystatin_discordance
          ? ' <span class="badge blue" title="Creatinine eGFR overestimates renal function; Cystatin C reveals true CKD">Cystatin-C Discordance</span>'
          : '';
        const unlinkedBadge = Number(p.unlinked_renewals || 0) > 0
          ? ' <span class="badge warn" title="Contains chronic refill processed without priorPrescription">Unlinked Refill Trap</span>'
          : '';

        const cascadeFlow = cgt.culprit_drug_key
          ? '<div style="margin-top:4px;font-size:11.5px;color:var(--danger);font-weight:600;">Culprit: ' +
              escHtml(cgt.culprit_drug_key) + ' &rarr; Draft: ' + escHtml(cgt.draft_drug_key || p.draft_medication || 'Order') +
            '</div>'
          : (cgt.draft_drug_key
              ? '<div style="margin-top:4px;font-size:11.5px;color:var(--accent);font-weight:600;">Non-Cascade Order: ' +
                  escHtml(cgt.draft_drug_key) + ' (No Culprit Drug)</div>'
              : '');

        const isSel = String(p.id) === String(selectedPatientId);
        return (
          '<tr class="' + (isSel ? 'selected-row' : '') + '">' +
            '<th>' +
              escHtml(p.first_name + ' ' + p.last_name) +
              '<br/><small style="font-weight:400;color:var(--muted);"><code>Patient/' + escHtml(p.id) + '</code> · ' +
              escHtml(p.age) + 'y ' + escHtml(p.gender) + '</small>' +
            '</th>' +
            '<td>' +
              badgeHtml + sarcBadge + unlinkedBadge +
              '<div style="margin-top:4px;font-weight:600;">' + escHtml(p.primary_condition) + '</div>' +
              '<small style="color:var(--muted);"><code>' + escHtml(rawArch) + '</code></small>' +
            '</td>' +
            '<td>' +
              '<div><strong>Visit Reason:</strong> ' + escHtml(p.latest_chief_complaint || 'Clinical evaluation') + '</div>' +
              '<small style="color:var(--muted);">' + escHtml(p.active_med_count || 6) + ' active meds (' + escHtml(p.total_med_orders || 25) + ' longitudinal orders over 18m)</small>' +
              cascadeFlow +
            '</td>' +
            '<td>' +
              '<button type="button" data-select-patient-id="' + escHtml(p.id) + '" data-select-archetype-id="' + escHtml(rawArch) + '">' +
                'Inspect &amp; Fire CDS Hook' +
              '</button>' +
            '</td>' +
          '</tr>'
        );
      }).join('');
    }

    async function selectPatient(patientId, archetypeId) {
      selectedPatientId = patientId;
      renderCohortTable();
      document.getElementById('selected-patient-badge').textContent = 'Evaluating Patient/' + patientId + '...';

      const qs = new URLSearchParams({ patientId });
      if (archetypeId) qs.set('archetypeId', archetypeId);
      const data = await fetch('/api/patient/chart?' + qs.toString()).then(r => r.json());
      latestChartData = data;

      const cds = data.cdsHooksOrderSign || {};
      const evalBlock = cds.evaluation || {};
      const gt = evalBlock.ground_truth || {};
      const card = (evalBlock.cards && evalBlock.cards[0]) || {};
      const isCrit = Boolean(evalBlock.should_fire_alert);

      const draftEntries = cds.context?.draftOrders?.entry || [];
      const draftMedName = draftEntries[0]?.resource?.medicationCodeableConcept?.text || gt.draft_drug_key || 'Draft Prescription';

      document.getElementById('selected-patient-badge').className = 'badge ' + (isCrit ? 'danger' : 'ok');
      document.getElementById('selected-patient-badge').textContent =
        'Patient/' + patientId + ' · ' + (isCrit ? 'INTERCEPT CASCADE' : 'NEGATIVE CONTROL (ALLOW)');

      document.getElementById('cds-card-container').innerHTML =
        '<div class="cds-banner ' + (isCrit ? 'critical' : 'info') + '">' +
          '<div class="cds-title">' +
            '<span>' + (isCrit ? '🛑 ' : '✅ ') + escHtml(card.summary || 'CDS Hooks Evaluation') + '</span>' +
            '<span class="badge ' + (isCrit ? 'danger' : 'ok') + '">Hook: order-sign · Draft: ' + escHtml(draftMedName) + '</span>' +
          '</div>' +
          '<div class="cds-detail">' + escHtml(card.detail || '') + '</div>' +
          (card.suggestions && card.suggestions.length > 0
            ? '<div style="margin-top:8px;font-size:12.5px;font-weight:600;color:var(--danger);">Recommended Action: ' +
                escHtml(card.suggestions[0].label) +
              '</div>'
            : '') +
          '<div class="cds-meta">' +
            '<span><strong>Chief Complaint:</strong> ' + escHtml(evalBlock.chief_complaint || 'N/A') + '</span>' +
            '<span><strong>eGFR (Creatinine 98979-8):</strong> ' + escHtml(gt.latest_egfr_creatinine ?? '—') + ' mL/min/1.73m²</span>' +
            '<span><strong>eGFR (Cystatin-C 50210-4):</strong> ' + escHtml(gt.latest_egfr_cystatin_c ?? '—') + ' mL/min/1.73m²</span>' +
          '</div>' +
        '</div>';

      // Render Reconciled Medication History Table
      const recon = evalBlock.reconciled_medication_history || [];
      const medTbody = document.getElementById('med-tbody');
      let medRowsHtml = '';

      // Show draft order at top
      if (draftEntries.length > 0) {
        const dr = draftEntries[0].resource;
        const drCode = dr.medicationCodeableConcept?.coding?.[0]?.code || '';
        medRowsHtml +=
          '<tr style="background:#FFFBEB;">' +
            '<th>' + escHtml(dr.medicationCodeableConcept?.text || 'Draft Order') + '<br/><small style="font-weight:400;color:var(--muted);">RxNorm <code>' + escHtml(drCode) + '</code></small></th>' +
            '<td><strong>Authored T₀:</strong> ' + escHtml(String(dr.authoredOn || '').slice(0, 10)) + '<br/><small style="color:var(--muted);">status: <code>draft</code> (Point of Prescribing)</small></td>' +
            '<td><span class="badge">New Draft Order</span></td>' +
            '<td><span class="badge ' + (isCrit ? 'danger' : 'ok') + '">' + (isCrit ? 'CASCADE TARGET ORDER' : 'APPROPRIATE ORDER') + '</span></td>' +
          '</tr>';
      }

      medRowsHtml += recon.map(m => {
        let roleBadge = '<span class="badge">CHRONIC BACKGROUND MED</span>';
        if (m.is_true_recent_initiation) {
          roleBadge = '<span class="badge danger">TRUE RECENT START (CULPRIT CANDIDATE)</span>';
        } else if (m.is_unlinked_pharmacy_renewal) {
          roleBadge = '<span class="badge warn">UNLINKED RENEWAL (CHRONIC — NOT A NEW START)</span>';
        }
        const linkBadge = m.has_explicit_prior_prescription
          ? '<span class="badge ok">Chained (priorPrescription)</span>'
          : (m.order_count > 1
              ? '<span class="badge warn">Missing priorPrescription (' + escHtml(m.order_count) + ' fills same RxNorm)</span>'
              : '<span class="badge">Initial Fill (1 order)</span>');

        return (
          '<tr>' +
            '<th>' + escHtml(m.display) + '<br/><small style="font-weight:400;color:var(--muted);">RxNorm <code>' + escHtml(m.rxnorm) + '</code></small></th>' +
            '<td>' +
              '<strong>' + escHtml(m.order_count) + ' orders</strong> · Init: <code>' + escHtml(String(m.true_initiation_authored_on || '').slice(0, 10)) + '</code><br/>' +
              '<small style="color:var(--muted);">Latest fill: <code>' + escHtml(String(m.latest_order_authored_on || '').slice(0, 10)) + '</code></small>' +
            '</td>' +
            '<td>' + linkBadge + '</td>' +
            '<td>' + roleBadge + '</td>' +
          '</tr>'
        );
      }).join('');
      medTbody.innerHTML = medRowsHtml || '<tr><td colspan="4">No medication orders found.</td></tr>';

      // Render Longitudinal Renal Observations Table
      const obsEntries = (data.fhirBundles?.Observation?.entry || []).map(e => e.resource);
      const labObs = obsEntries.filter(o => {
        const code = o.code?.coding?.[0]?.code;
        return ['2160-0', '98979-8', '1751-7', '3368-8', '50210-4', '2823-3'].includes(code);
      });
      const discordanceBadge = document.getElementById('renal-discordance-badge');
      if (gt.sarcopenic_cystatin_discordance) {
        discordanceBadge.className = 'badge danger';
        discordanceBadge.textContent = '⚠️ Sarcopenic Masking: eGFR-Cr ' + gt.latest_egfr_creatinine + ' vs. eGFR-Cys ' + gt.latest_egfr_cystatin_c + ' mL/min/1.73m²';
      } else {
        discordanceBadge.className = 'badge blue';
        discordanceBadge.textContent = 'LOINC 2160-0 · 98979-8 · 1751-7 · 3368-8 · 50210-4';
      }

      document.getElementById('lab-tbody').innerHTML = labObs.slice().reverse().map(o => {
        const coding = o.code?.coding?.[0] || {};
        const val = o.valueQuantity?.value;
        const unit = o.valueQuantity?.unit || '';
        const flag = o.interpretation?.[0]?.coding?.[0]?.code || 'N';
        const flagBadge = flag === 'H' || flag === 'L'
          ? '<span class="badge ' + (coding.code === '3368-8' || coding.code === '50210-4' ? 'danger' : 'warn') + '">' + escHtml(flag) + '</span>'
          : '<span class="badge ok">Normal</span>';
        return (
          '<tr>' +
            '<th>' + escHtml(coding.display || o.code?.text || 'Lab') + '</th>' +
            '<td><code>' + escHtml(coding.code) + '</code></td>' +
            '<td><strong>' + escHtml(val) + ' ' + escHtml(unit) + '</strong> ' + flagBadge + '</td>' +
            '<td><code>' + escHtml(String(o.effectiveDateTime || '').slice(0, 10)) + '</code></td>' +
          '</tr>'
        );
      }).join('') || '<tr><td colspan="4">No LOINC renal observations found.</td></tr>';

      showInspectorTab('cds');
    }

    function showInspectorTab(tab) {
      if (!latestChartData) return;
      const box = document.getElementById('inspector-box');
      if (tab === 'cds') {
        box.textContent = JSON.stringify(latestChartData.cdsHooksOrderSign, null, 2);
      } else if (tab === 'meds') {
        box.textContent = JSON.stringify(latestChartData.fhirBundles.MedicationRequest, null, 2);
      } else if (tab === 'obs') {
        box.textContent = JSON.stringify(latestChartData.fhirBundles.Observation, null, 2);
      } else if (tab === 'enc') {
        box.textContent = JSON.stringify({
          Encounter: latestChartData.fhirBundles.Encounter,
          Condition: latestChartData.fhirBundles.Condition
        }, null, 2);
      }
    }

    async function admitMorePatients() {
      const btn = document.getElementById('admit-btn');
      const count = Number(document.getElementById('admit-count-select').value || 100);
      btn.disabled = true;
      btn.textContent = 'Admitting ' + count + ' seniors...';
      try {
        const res = await fetch('/api/cohort/admit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count })
        }).then(r => r.json());
        document.getElementById('inspector-box').textContent = JSON.stringify(res, null, 2);
        await refreshCohort();
      } finally {
        btn.disabled = false;
        btn.textContent = '+ Admit Evaluation Cohort';
      }
    }

    async function runTenCaseBenchmark() {
      const btn = document.getElementById('benchmark-btn');
      btn.disabled = true;
      btn.textContent = 'Running 10-Case Eval...';
      try {
        const report = await fetch('/api/benchmark/run', { method: 'POST' }).then(r => r.json());
        document.getElementById('inspector-box').textContent = JSON.stringify(report, null, 2);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Run 10-Case Cascade vs. Control Benchmark';
      }
    }

    async function refreshCohort() {
      const [health, cohort] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/cohort').then(r => r.json())
      ]);

      document.getElementById('status-badges').innerHTML = [
        '<span class="badge ok">Prod Env: ' + escHtml(health.envStatus) + '</span>',
        '<span class="badge">Wallet: $' + escHtml(health.walletBalanceUsd) + '</span>'
      ].join('');

      document.getElementById('api-config-snippet').textContent = JSON.stringify({
        organization: health.orgName,
        environmentId: health.environmentId,
        fhirR4BaseUrl: health.fhirBaseUrl,
        endpoints: {
          medicationRequests: health.fhirBaseUrl + '/MedicationRequest?patient=pat-013&_count=100',
          renalObservations: health.fhirBaseUrl + '/Observation?patient=pat-013&_count=100',
          conditionsIcd10: health.fhirBaseUrl + '/Condition?patient=pat-013&_count=50',
          encountersChiefComplaint: health.fhirBaseUrl + '/Encounter?patient=pat-013&_count=50',
          cdsHooksOrderSign: health.cdsHookUrl,
          batchAdmitUpTo500: health.fhirBaseUrl.replace('/fhir', '/patients/admit')
        }
      }, null, 2);

      const s = cohort.summary || {};
      document.getElementById('kpi-total').textContent = s.total_geriatric_patients ?? 0;
      document.getElementById('kpi-pos').textContent = s.positive_cascades ?? 0;
      document.getElementById('kpi-neg').textContent = s.negative_controls ?? 0;
      document.getElementById('kpi-unlinked').textContent = s.unlinked_renewal_patients ?? 0;
      document.getElementById('kpi-sarcopenic').textContent = s.sarcopenic_discordance_cases ?? 0;

      allPatients = cohort.patients || [];
      renderCohortTable();

      if (!selectedPatientId && allPatients.length > 0) {
        const firstCascade = allPatients.find(p => p.is_prescribing_cascade) || allPatients[0];
        const rawArch = String(firstCascade.archetype_id || '').replace(/^geriatric_polypharmacy_/, '');
        await selectPatient(firstCascade.id, rawArch);
      }
    }

    refreshCohort();
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
    close: () => new Promise((resolve) => server.close(() => resolve()))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3016)
  const boot = await bootstrapCascadeEnvironment()
  console.log(
    `Authenticated via hebrah login (Org: ${boot.orgName} · ${boot.email}) · API: ${boot.baseUrl}`
  )
  console.log(`Active Isolated Health Environment: ${boot.environmentId}`)
  console.log(`View in Hebrah Dashboard: ${boot.appUrl}/environments/${boot.environmentId}`)

  const app = createCascadeDemoServer(boot)
  app.server.listen(port, '127.0.0.1', () => {
    console.log(
      `Prescribing Cascade & Negative Control Demo listening at http://127.0.0.1:${port}`
    )
  })
}
