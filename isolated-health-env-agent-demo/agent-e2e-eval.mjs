import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HebrahClient, HebrahAgentHarness, redactSecrets } from '@hebrah/sdk'
import { createHealthAppServer } from './server.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WWW_URL = (process.env.WWW_URL || 'https://hebrah-staging-www-76zyj6ngda-uc.a.run.app').replace(/\/$/, '')

const metrics = []
const findings = []

async function timed(category, name, fn) {
  const start = performance.now()
  try {
    const result = await fn()
    const latencyMs = Number((performance.now() - start).toFixed(1))
    const isOk = result?.ok !== false
    metrics.push({
      category,
      name,
      status: result?.status ?? 'OK',
      ok: isOk,
      latencyMs,
      note: result?.note || ''
    })
    console.log(`[${isOk ? 'PASS' : 'FAIL'}] [${category}] ${name} (${latencyMs} ms)${result?.note ? ' — ' + result.note : ''}`)
    return result
  } catch (err) {
    const latencyMs = Number((performance.now() - start).toFixed(1))
    const msg = redactSecrets(String(err?.message || err))
    metrics.push({
      category,
      name,
      status: err?.status || 'ERR',
      ok: false,
      latencyMs,
      note: msg
    })
    console.log(`[FAIL] [${category}] ${name} (${latencyMs} ms) — ${msg}`)
    return { ok: false, error: msg, status: err?.status }
  }
}

async function rawFetch(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // non-json
  }
  return { status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), text, json }
}

async function main() {
  console.log('====================================================================')
  console.log(' HEBRAH STAGING END-TO-END AI AGENT EVALUATION (NODE.JS)')
  console.log(` Starting at: ${WWW_URL}/`)
  console.log('====================================================================\n')

  // -------------------------------------------------------------------------
  // PHASE 1: Agent Discovery on hebrah-staging-www
  // -------------------------------------------------------------------------
  const htmlLanding = await timed('1. Discovery', 'GET / (HTML Landing)', async () => {
    const r = await rawFetch(`${WWW_URL}/`)
    return { status: r.status, ok: r.ok, note: `${r.text.length} bytes, Content-Type: ${r.headers['content-type']}` }
  })

  const mdLanding = await timed('1. Discovery', 'GET / (Accept: text/markdown)', async () => {
    const r = await rawFetch(`${WWW_URL}/`, { headers: { Accept: 'text/markdown' } })
    return { status: r.status, ok: r.ok, text: r.text, note: `${r.text.length} bytes, Content-Type: ${r.headers['content-type']}` }
  })

  const skillDoc = await timed('1. Discovery', 'GET /SKILL.md', async () => {
    const r = await rawFetch(`${WWW_URL}/SKILL.md`)
    return { status: r.status, ok: r.ok, text: r.text, note: `${r.text.length} bytes` }
  })

  await timed('1. Discovery', 'GET /.well-known/api-catalog', async () => {
    const r = await rawFetch(`${WWW_URL}/.well-known/api-catalog`)
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status} (${r.text.length} bytes)` }
  })

  await timed('1. Discovery', 'GET /llms.txt', async () => {
    const r = await rawFetch(`${WWW_URL}/llms.txt`)
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status} (${r.text.length} bytes)` }
  })

  await timed('1. Discovery', 'GET /robots.txt', async () => {
    const r = await rawFetch(`${WWW_URL}/robots.txt`)
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status} (${r.text.length} bytes)` }
  })

  const wellKnownAgent = await timed('1. Discovery', 'GET /.well-known/agent-configuration', async () => {
    const r = await rawFetch(`${WWW_URL}/.well-known/agent-configuration`)
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status}` }
  })
  if (!wellKnownAgent.ok) {
    findings.push({
      severity: 'Medium',
      area: 'Discovery (hebrah-www)',
      title: '`/.well-known/agent-configuration` returns 404 Not Found',
      detail: 'Agents probing standard `.well-known/agent-configuration` receive a 404. While `/.well-known/api-catalog`, `/SKILL.md`, and `/llms.txt` work, adding a route or redirect for `/.well-known/agent-configuration` improves standard agent discovery.'
    })
  }

  // Parse URLs from SKILL.md
  const apiUrlMatch = skillDoc.text?.match(/\*\*API Control Plane \(`apiUrl`\)\*\*:\s*`([^`]+)`/)
  const appUrlMatch = skillDoc.text?.match(/\*\*Dashboard URL \(`appUrl`\)\*\*:\s*`([^`]+)`/)
  const mcpUrlMatch = skillDoc.text?.match(/\*\*MCP Endpoint \(`mcpUrl`\)\*\*:\s*`([^`]+)`/)

  const apiUrl = apiUrlMatch ? apiUrlMatch[1] : 'https://hebrah-staging-api-76zyj6ngda-uc.a.run.app'
  const appUrl = appUrlMatch ? appUrlMatch[1] : 'https://hebrah-staging-app-76zyj6ngda-uc.a.run.app'
  const mcpUrl = mcpUrlMatch ? mcpUrlMatch[1] : 'https://hebrah-staging-mcp-76zyj6ngda-uc.a.run.app/mcp'

  console.log(`\nParsed from SKILL.md -> apiUrl: ${apiUrl} | appUrl: ${appUrl} | mcpUrl: ${mcpUrl}\n`)

  // -------------------------------------------------------------------------
  // PHASE 2: Agent Self-Signup & Registration Shield
  // -------------------------------------------------------------------------
  const register404Check = await timed(
    '2. Onboarding & Auth',
    'Markdown Guide Endpoint: POST /v1/agent/register',
    async () => {
      const r = await rawFetch(`${apiUrl}/v1/agent/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: 'my-agent',
          agent_name: 'my-agent',
          contact_email: 'developer@hebrah.com'
        })
      })
      if (!r.ok) {
        findings.push({
          severity: 'Critical',
          area: 'Agent Onboarding (hebrah-www / hebrah-api)',
          title: 'Markdown guide documents `POST /v1/agent/register`, which returns 404 Not Found (actual endpoint is `POST /v1/agent/account`)',
          detail:
            'Landing page `Accept: text/markdown` and `/llms.txt` instruct headless HTTP agents to call `POST /v1/agent/register` with `{"org_name","agent_name","contact_email"}`. That route does not exist on `hebrah-api` (HTTP 404); the actual endpoint used by `@hebrah/cli` is `POST /v1/agent/account` with `{"orgName","inviteEmail","agentName"}`.'
        })
      }
      return {
        status: r.status,
        ok: r.ok,
        note: `HTTP ${r.status} (documented in Accept: text/markdown, actual route is /v1/agent/account)`
      }
    }
  )

  await timed('2. Onboarding & Auth', 'Registration Shield on POST /v1/agent/account (Block @example.com)', async () => {
    const r = await rawFetch(`${apiUrl}/v1/agent/account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: 'shield-test-agent',
        agentName: 'shield-test-agent',
        inviteEmail: 'bot@example.com'
      })
    })
    const blocked = r.status === 400 || r.status === 422
    return {
      status: r.status,
      ok: blocked,
      note: blocked ? `Correctly blocked disposable/dummy domain (${r.status})` : `Unexpected status ${r.status}`
    }
  })

  const ts = Date.now()
  const agentEmail = `agent-e2e-${ts}@hebrah.com`
  const signupRes = await timed('2. Onboarding & Auth', 'POST /v1/agent/account ($5 Free Trial Signup)', async () => {
    const r = await rawFetch(`${apiUrl}/v1/agent/account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `Node E2E Agent ${ts}`,
        agentName: `node-e2e-agent-${ts}`,
        inviteEmail: agentEmail
      })
    })
    if (!r.ok) {
      throw new Error(`Signup failed (${r.status}): ${r.text}`)
    }
    return {
      status: r.status,
      ok: true,
      data: r.json,
      note: `orgId=${r.json.orgId}, keyPrefix=${r.json.keyPrefix}, claimUrl=${r.json.claimUrl ? 'present' : 'none'}`
    }
  })

  const apiKey = signupRes.data.apiKey
  const orgId = signupRes.data.orgId
  const claimUrl = signupRes.data.claimUrl

  // Initialize @hebrah/sdk HebrahClient
  const client = new HebrahClient({
    apiKey,
    baseUrl: apiUrl
  })

  await timed('2. Onboarding & Auth', 'SDK client.health()', async () => {
    const h = await client.health()
    return { status: 200, ok: h.status === 'ok', note: `status=${h.status}` }
  })

  await timed('2. Onboarding & Auth', 'SDK client.agent.wallet()', async () => {
    const w = await client.agent.wallet()
    return { status: 200, ok: w.balance_cents === 500, note: `balance=${w.balance_usd} (${w.balance_cents}c)` }
  })

  // -------------------------------------------------------------------------
  // PHASE 3: Conversational Architect, Environment Creation & MCP
  // -------------------------------------------------------------------------
  // Test SKILL.md documented body {"message": "...", "auto_provision": false} vs SDK {"prompt": "..."}
  await timed('3. Architect & Provisioning', 'SKILL.md Architect Payload (`{"message": "..."}`)', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/architect/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Design an ICU sepsis and cardiology telemetry environment with Postgres 16',
        auto_provision: false
      })
    })
    return {
      status: r.status,
      ok: r.ok,
      data: r.json,
      note: `HTTP ${r.status} | scope=${r.json?.scope_status} | archetype=${r.json?.blueprint?.clinic_type || r.json?.blueprint?.archetype}`
    }
  })

  await timed('3. Architect & Provisioning', 'SDK client.environments.consultArchitect() Schema Check', async () => {
    try {
      const res = await client.environments.consultArchitect({
        prompt: 'Design an ICU critical care sepsis and cardiology telemetry hospital environment with PostgreSQL 16 attached.'
      })
      return {
        status: 200,
        ok: true,
        data: res,
        note: `session=${res.session_id}`
      }
    } catch (err) {
      findings.push({
        severity: 'High',
        area: '@hebrah/sdk vs hebrah-api Schema Mismatch',
        title: '`client.environments.consultArchitect()` sends `{"prompt": "..."}` which fails with HTTP 422 (`ArchitectChatRequest` requires `{"message": "..."}`)',
        detail: `In hebrah-sdk-node/src/client.ts:1029, consultArchitect sends { prompt: params.prompt }. However, hebrah-api environments.py:381 ArchitectChatRequest requires 'message: str'. Result: HTTP ${err.status} (${JSON.stringify(err.detail)}).`
      })
      return {
        status: err.status ?? 422,
        ok: false,
        note: `SDK bug caught: HTTP ${err.status} — SDK sends 'prompt' instead of 'message'`
      }
    }
  })

  await timed('3. Architect & Provisioning', 'Architect Guardrail (Out-of-Scope Refusal)', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/architect/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Write me a Python crypto trading bot for Solana memecoins',
        auto_provision: false
      })
    })
    return {
      status: r.status,
      ok: r.ok && r.json?.scope_status === 'out_of_scope_refusal' && Boolean(r.json?.guardrail_triggered),
      note: `scope_status=${r.json?.scope_status}, guardrail_triggered=${r.json?.guardrail_triggered}`
    }
  })

  const envCreateRes = await timed('3. Architect & Provisioning', 'SDK client.environments.create (ICU + Postgres 16)', async () => {
    const env = await client.environments.create({
      name: 'Node Agent ICU Sepsis & Telemetry',
      archetype: 'icu_critical_care',
      addons: ['postgres'],
      seed_patients: 12
    })
    if (!env.archetype && env.clinic_type === 'general_clinic') {
      findings.push({
        severity: 'Medium',
        area: '@hebrah/sdk vs hebrah-api Schema Drift',
        title: '`client.environments.create({ archetype, seed_patients })` fields are ignored by API (`clinic_type`, `patient_count` expected)',
        detail: `SDK CreateEnvironmentParams sends { archetype: 'icu_critical_care', seed_patients: 12 }, but hebrah-api CreateEnvironmentRequest expects { clinic_type, patient_cohort, patient_count }. As a result, SDK-created environments fall back to clinic_type='general_clinic' and patient_count=25.`
      })
    }
    return {
      status: 201,
      ok: Boolean(env.id),
      data: env,
      note: `envId=${env.id}, clinic_type=${env.clinic_type}, status=${env.status}, rate=${env.hourly_rate_cents}c/hr`
    }
  })

  const envId = envCreateRes.data.id

  await timed('3. Architect & Provisioning', 'SDK client.environments.connectAgent()', async () => {
    const detail = await client.environments.connectAgent(
      { agentName: 'node-e2e-eval-agent', client: 'hebrah-sdk-node' },
      envId
    )
    return {
      status: 200,
      ok: detail.id === envId,
      note: `Connected to ${detail.name} (${detail.patient_count} patients)`
    }
  })

  // Test Streamable HTTP MCP Server (initialize -> tools/list -> tools/call)
  await timed('3. Architect & Provisioning', 'Hosted MCP Initialize + tools/list + tools/call (Streamable HTTP)', async () => {
    const initRes = await rawFetch(mcpUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'hebrah-node-e2e-eval', version: '1.0.0' }
        }
      })
    })
    const mcpSessionId = initRes.headers['mcp-session-id']
    const listRes = await rawFetch(mcpUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(mcpSessionId ? { 'mcp-session-id': mcpSessionId } : {})
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    })
    let parsedTools = listRes.json?.result?.tools
    if (!parsedTools && listRes.text) {
      const dataLine = listRes.text.split('\n').find((l) => l.startsWith('data: '))
      if (dataLine) {
        try {
          parsedTools = JSON.parse(dataLine.slice(6))?.result?.tools
        } catch {
          // ignore
        }
      }
    }
    const toolCount = parsedTools?.length ?? 0
    return {
      status: listRes.status,
      ok: listRes.ok && toolCount > 0,
      note: `session=${mcpSessionId?.slice(0, 8)}..., ${toolCount} MCP tools discovered`
    }
  })

  // -------------------------------------------------------------------------
  // PHASE 4: Clinical Capability Packs & Data Retrieval (SDK + SKILL.md Audit)
  // -------------------------------------------------------------------------
  const tablesRes = await timed('4. Data Retrieval', 'SDK client.db.tables() (Postgres Schema)', async () => {
    const t = await client.db.tables(envId)
    return {
      status: 200,
      ok: Array.isArray(t.tables) && t.tables.length >= 15,
      data: t,
      note: `schema=${t.schema}, ${t.tables.length} tables (${t.tables.map((x) => `${x.table_name}:${x.row_count}`).slice(0, 5).join(', ')}...)`
    }
  })

  const patientsQueryRes = await timed('4. Data Retrieval', 'SDK client.db.query (SELECT patients JOIN encounters)', async () => {
    const q = await client.db.query(
      `SELECT p.id, p.mrn, p.first_name, p.last_name, p.department, p.acuity_level, p.primary_condition,
              COUNT(e.id) AS encounter_count
       FROM patients p
       LEFT JOIN encounters e ON e.patient_id = p.id
       GROUP BY p.id, p.mrn, p.first_name, p.last_name, p.department, p.acuity_level, p.primary_condition
       ORDER BY p.id ASC
       LIMIT 10`,
      undefined,
      envId
    )
    return {
      status: 200,
      ok: q.row_count > 0,
      data: q,
      note: `${q.row_count} rows returned in ${q.duration_ms}ms DB execution`
    }
  })

  const samplePatientId = patientsQueryRes.data.rows[0]?.id

  await timed('4. Data Retrieval', 'SDK client.environments.getPatientChart()', async () => {
    const chart = await client.environments.getPatientChart(envId, samplePatientId)
    return {
      status: 200,
      ok: Boolean(chart.patient),
      note: `patient=${chart.patient?.first_name} ${chart.patient?.last_name}, vitals=${chart.vitals?.length ?? 0}, labs=${chart.labs?.length ?? 0}, meds=${chart.medications?.length ?? 0}`
    }
  })

  // Audit SKILL.md Table Endpoints vs Actual API Routes
  await timed('4. Data Retrieval', 'SKILL.md Endpoint: GET /v1/environments/{id}/fhir/Patient', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/fhir/Patient`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!r.ok) {
      findings.push({
        severity: 'High',
        area: 'SKILL.md Endpoint Accuracy',
        title: '`GET /v1/environments/<ENV_ID>/fhir/Patient` in `SKILL.md` returns 404 Not Found',
        detail: `SKILL.md line 53 and line 199 instruct agents to call GET /v1/environments/<ENV_ID>/fhir/Patient, which returns HTTP ${r.status}. Actual patient list endpoint is GET /v1/environments/<ENV_ID>/ehr/patients (or /fhir/ValueSet/$expand, /fhir/$export).`
      })
    }
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status}` }
  })

  await timed('4. Data Retrieval', 'SKILL.md Endpoint: POST /v1/environments/{id}/fhir/bulk-export', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/fhir/bulk-export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!r.ok) {
      findings.push({
        severity: 'Medium',
        area: 'SKILL.md Endpoint Accuracy',
        title: '`POST /v1/environments/<ENV_ID>/fhir/bulk-export` in `SKILL.md` returns 404 (actual route is `/fhir/$export`)',
        detail: `SKILL.md line 199 documents POST /fhir/bulk-export, which returns HTTP ${r.status}. The actual FHIR Bulk Data endpoint on hebrah-api is POST /v1/environments/<ENV_ID>/fhir/$export.`
      })
    }
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status}` }
  })

  await timed('4. Data Retrieval', 'Actual FHIR Bulk Export: POST /v1/environments/{id}/fhir/$export', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/fhir/$export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    return {
      status: r.status,
      ok: r.ok,
      note: `HTTP ${r.status}, job_id=${r.json?.job_id}, streams=${r.json?.output?.length ?? 0}`
    }
  })

  await timed('4. Data Retrieval', 'FHIR Terminology: GET /fhir/ValueSet/$expand?url=sepsis', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/fhir/ValueSet/$expand?url=sepsis`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    return {
      status: r.status,
      ok: r.ok,
      note: `HTTP ${r.status}, concepts=${r.json?.expansion?.total ?? 0}`
    }
  })

  await timed('4. Data Retrieval', 'DICOMweb PACS: GET /v1/environments/{id}/dicomweb/studies', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/dicomweb/studies`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    return {
      status: r.status,
      ok: r.ok,
      note: `HTTP ${r.status}, studies=${Array.isArray(r.json) ? r.json.length : r.json?.studies?.length ?? 0}`
    }
  })

  await timed('4. Data Retrieval', 'IEEE 11073 Telemetry: GET /v1/environments/{id}/devices/telemetry', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/devices/telemetry`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    return {
      status: r.status,
      ok: r.ok,
      note: `HTTP ${r.status}, streams=${r.json?.telemetry?.length ?? r.json?.count ?? 0}`
    }
  })

  await timed('4. Data Retrieval', 'IHE XDS.b & C-CDA: GET /v1/environments/{id}/hie/xds/query', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/hie/xds/query`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    return {
      status: r.status,
      ok: r.ok,
      note: `HTTP ${r.status}, documents=${r.json?.documents?.length ?? 0}`
    }
  })

  await timed('4. Data Retrieval', 'SDOH & Genomics: GET /sdoh & GET /genomics', async () => {
    const [sdoh, gen] = await Promise.all([
      rawFetch(`${apiUrl}/v1/environments/${envId}/sdoh`, { headers: { Authorization: `Bearer ${apiKey}` } }),
      rawFetch(`${apiUrl}/v1/environments/${envId}/genomics`, { headers: { Authorization: `Bearer ${apiKey}` } })
    ])
    return {
      status: sdoh.status,
      ok: sdoh.ok && gen.ok,
      note: `sdoh=${sdoh.status}, genomics=${gen.status}`
    }
  })

  await timed('4. Data Retrieval', 'SKILL.md Endpoint: POST /v1/environments/{id}/edi', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/edi`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction_type: '270', patient_id: samplePatientId })
    })
    if (!r.ok) {
      findings.push({
        severity: 'Medium',
        area: 'SKILL.md Endpoint Accuracy',
        title: '`POST /v1/environments/<ENV_ID>/edi` in `SKILL.md` returns 404 Not Found',
        detail: `SKILL.md line 205 documents POST /v1/environments/<ENV_ID>/edi for X12 270/271/278/837, but that route is not mounted on hebrah-api (HTTP ${r.status}). X12 claims are stored in the claims_x12 Postgres table.`
      })
    }
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status}` }
  })

  await timed('4. Data Retrieval', 'SKILL.md Endpoint: POST /v1/environments/{id}/scenarios/trigger', async () => {
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/scenarios/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ scenario: 'icu_sepsis_deterioration' })
    })
    if (!r.ok) {
      findings.push({
        severity: 'High',
        area: 'SKILL.md Endpoint Accuracy',
        title: '`POST /v1/environments/<ENV_ID>/scenarios/trigger` in `SKILL.md` returns 404 (missing `/ehr` prefix)',
        detail: `SKILL.md line 206 documents POST /v1/environments/<ENV_ID>/scenarios/trigger, which returns HTTP ${r.status}. The actual route mounted in environments.py is POST /v1/environments/<ENV_ID>/ehr/scenarios/trigger (or /clinic/scenarios).`
      })
    }
    return { status: r.status, ok: r.ok, note: `HTTP ${r.status}` }
  })

  await timed('4. Data Retrieval', 'SDK client.environments.openDataCatalog()', async () => {
    const cat = await client.environments.openDataCatalog(envId)
    return {
      status: 200,
      ok: Boolean(cat),
      note: `packs=${cat.packs?.length ?? Object.keys(cat).length}`
    }
  })

  await timed('4. Data Retrieval', 'SKILL.md Studio Payload (`{"message": "..."}`) vs SDK (`{"prompt": "..."}`)', async () => {
    const rMsg = await rawFetch(`${apiUrl}/v1/environments/${envId}/studio/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Summarize ICU sepsis cohort', auto_run_tools: true })
    })
    let sdkFailedWith422 = false
    try {
      await client.environments.consultStudio(envId, {
        prompt: 'Summarize our ICU sepsis patients and recommend clinical actions'
      })
    } catch (err) {
      sdkFailedWith422 = err.status === 422
      findings.push({
        severity: 'High',
        area: '@hebrah/sdk vs hebrah-api Schema Mismatch',
        title: '`client.environments.consultStudio()` sends `{"prompt": "..."}` which fails with HTTP 422 (`StudioChatRequest` requires `{"message": "..."}`)',
        detail: `In hebrah-sdk-node/src/client.ts:1058, consultStudio sends { prompt: params.prompt }. However, hebrah-api environments.py:5338 StudioChatRequest requires 'message: str'. Result: HTTP ${err.status}.`
      })
    }
    return {
      status: rMsg.status,
      ok: rMsg.ok,
      note: `SKILL.md 'message' HTTP ${rMsg.status} (session=${rMsg.json?.session_id}); SDK 'prompt' HTTP 422=${sdkFailedWith422}`
    }
  })

  // -------------------------------------------------------------------------
  // PHASE 5: Database Input / Writes to PostgreSQL Add-On & Guardrails
  // -------------------------------------------------------------------------
  await timed('5. Postgres DB Input & Guardrails', 'Postgres DDL: CREATE TABLE IF NOT EXISTS clinical_triage_notes', async () => {
    const res = await client.db.query(
      `CREATE TABLE IF NOT EXISTS clinical_triage_notes (
        note_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        author_agent TEXT NOT NULL,
        severity TEXT NOT NULL,
        lactate_mmol NUMERIC(5,2),
        note_text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      undefined,
      envId
    )
    return { status: 200, ok: true, note: `Created table in isolated schema (${res.duration_ms}ms)` }
  })

  const insertedNoteId = `note-${Date.now()}`
  await timed('5. Postgres DB Input & Guardrails', 'Postgres DML: INSERT INTO clinical_triage_notes (parameterized)', async () => {
    const res = await client.db.query(
      `INSERT INTO clinical_triage_notes (note_id, patient_id, author_agent, severity, lactate_mmol, note_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING note_id, patient_id, severity, lactate_mmol`,
      [
        insertedNoteId,
        samplePatientId,
        'node-e2e-eval-agent',
        'CRITICAL',
        4.6,
        'Synthetic ICU triage note: elevated lactate 4.6 mmol/L, initiated sepsis bundle.'
      ],
      envId
    )
    return {
      status: 200,
      ok: res.row_count === 1 && res.rows[0]?.note_id === insertedNoteId,
      note: `Inserted & returned note_id=${res.rows[0]?.note_id}`
    }
  })

  await timed('5. Postgres DB Input & Guardrails', 'Postgres DML: UPDATE clinical_triage_notes', async () => {
    const res = await client.db.query(
      `UPDATE clinical_triage_notes
       SET severity = $1, lactate_mmol = $2
       WHERE note_id = $3
       RETURNING note_id, severity, lactate_mmol`,
      ['RESOLVED_STABLE', 1.8, insertedNoteId],
      envId
    )
    return {
      status: 200,
      ok: res.row_count === 1 && res.rows[0]?.severity === 'RESOLVED_STABLE',
      note: `Updated severity=${res.rows[0]?.severity}, lactate=${res.rows[0]?.lactate_mmol}`
    }
  })

  await timed('5. Postgres DB Input & Guardrails', 'SDK client.db.recordOutcome() -> app_outcomes table', async () => {
    const out = await client.db.recordOutcome(
      {
        patientId: samplePatientId,
        outcomeType: 'icu_sepsis_bundle_initiated',
        sourceAgent: 'node-e2e-eval-agent',
        score: 92,
        summary: 'Initiated 1-hour sepsis bundle following qSOFA=3 and lactate=4.6 mmol/L',
        payload: { antibiotic: 'piperacillin-tazobactam', fluid_bolus_ml: 2100 }
      },
      envId
    )
    return {
      status: 200,
      ok: out.success === true,
      note: `outcome_id=${out.outcome?.id}, score=${out.outcome?.score}`
    }
  })

  await timed('5. Postgres DB Input & Guardrails', 'SDK client.environments.admitPatients() (Dynamic Cohort Input)', async () => {
    const adm = await client.environments.admitPatients(envId, {
      count: 3,
      cohort: 'sepsis_shock',
      acuity: 'critical',
      notes: 'Admitted via Node.js E2E agent evaluation'
    })
    return {
      status: 200,
      ok: (adm.admitted_count ?? adm.patients?.length ?? 0) > 0,
      note: `admitted=${adm.admitted_count ?? adm.patients?.length}, total=${adm.total_patients}`
    }
  })

  // Test Guardrails on Database Input
  await timed('5. Postgres DB Input & Guardrails', 'SQL AST Guardrail: Block DROP TABLE patients', async () => {
    try {
      await client.db.query('DROP TABLE patients', undefined, envId)
      return { status: 200, ok: false, note: 'ERROR: DROP TABLE was not blocked!' }
    } catch (err) {
      return {
        status: err.status,
        ok: err.status === 403,
        note: `Blocked with HTTP ${err.status}: ${err.message}`
      }
    }
  })

  await timed('5. Postgres DB Input & Guardrails', 'SQL AST Guardrail: Block Cross-Schema public.organizations', async () => {
    try {
      await client.db.query('SELECT * FROM public.organizations LIMIT 1', undefined, envId)
      return { status: 200, ok: false, note: 'ERROR: Cross-schema query was not blocked!' }
    } catch (err) {
      return {
        status: err.status,
        ok: err.status === 403,
        note: `Blocked with HTTP ${err.status}: ${err.message}`
      }
    }
  })

  await timed('5. Postgres DB Input & Guardrails', 'Inbound DLP Guardrail: Block Real SSN Pattern in SQL & Outcomes', async () => {
    let sqlBlocked = false
    let outcomeBlocked = false
    try {
      await client.db.query("INSERT INTO clinical_triage_notes (note_id, patient_id, author_agent, severity, note_text) VALUES ('dlp-1', 'p1', 'agent', 'HIGH', 'Patient SSN is 123-45-6789')", undefined, envId)
    } catch (err) {
      sqlBlocked = err.status === 400
    }
    try {
      await client.db.recordOutcome(
        {
          patientId: samplePatientId,
          outcomeType: 'dlp_test',
          summary: 'Real SSN 123-45-6789 leaked in summary'
        },
        envId
      )
    } catch (err) {
      outcomeBlocked = err.status === 400
    }
    return {
      status: 400,
      ok: sqlBlocked && outcomeBlocked,
      note: `sqlBlocked=${sqlBlocked}, outcomeBlocked=${outcomeBlocked}`
    }
  })

  // -------------------------------------------------------------------------
  // PHASE 6: WebSockets (`wss://.../ws`) & Local Node.js Health App E2E
  // -------------------------------------------------------------------------
  const localApp = createHealthAppServer({
    apiKey,
    baseUrl: apiUrl,
    environmentId: envId
  })

  await timed('6. WebSockets & Local Health App', 'Local App: Initialize Custom Postgres Table (sepsis_triage_queue)', async () => {
    await localApp.ensureAppSchema()
    return { status: 200, ok: true, note: 'sepsis_triage_queue ready' }
  })

  const wsConnRes = await timed('6. WebSockets & Local Health App', 'WebSocket Connect: wss://.../v1/environments/{id}/ws', async () => {
    const res = await localApp.connectUpstreamWebSocket()
    return {
      status: res.connected ? 101 : 500,
      ok: res.connected,
      note: res.connected ? `Greeting: ${res.info?.message}` : `Failed: ${res.info}`
    }
  })

  await timed('6. WebSockets & Local Health App', 'WebSocket Bidirectional Ping -> PONG', async () => {
    const pong = await localApp.pingUpstreamWebSocket()
    return {
      status: pong.ok ? 200 : 500,
      ok: pong.ok,
      note: pong.ok ? `RTT=${pong.latencyMs}ms (server ts=${pong.timestamp})` : pong.error
    }
  })

  // Start local HTTP server on ephemeral port
  const localPort = await new Promise((resolve) => {
    localApp.server.listen(0, '127.0.0.1', () => {
      resolve(localApp.server.address().port)
    })
  })
  const localBaseUrl = `http://127.0.0.1:${localPort}`

  await timed('6. WebSockets & Local Health App', 'Local App GET /api/health', async () => {
    const r = await rawFetch(`${localBaseUrl}/api/health`)
    return {
      status: r.status,
      ok: r.ok && r.json?.wsConnected === true,
      note: `envStatus=${r.json?.envStatus}, wsConnected=${r.json?.wsConnected}, wallet=${r.json?.walletBalanceUsd}`
    }
  })

  await timed('6. WebSockets & Local Health App', 'Local App POST /api/triage (Postgres Write + Outcome)', async () => {
    const r = await rawFetch(`${localBaseUrl}/api/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: samplePatientId,
        qsofaScore: 3,
        lactateMmol: 4.8
      })
    })
    return {
      status: r.status,
      ok: r.status === 201 && r.json?.triageStatus === 'CRITICAL_SEPSIS_ALERT',
      note: `queueId=${r.json?.queueId}, outcomeId=${r.json?.outcome?.id}, status=${r.json?.triageStatus}`
    }
  })

  await timed('6. WebSockets & Local Health App', 'Local App POST /api/scenario -> Real-Time HL7 v2 WebSocket Broadcast', async () => {
    const beforeCount = localApp.getWsEvents().length
    const r = await rawFetch(`${localBaseUrl}/api/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: 'icu_sepsis_deterioration',
        patientId: samplePatientId
      })
    })
    // Wait 400ms for async WebSocket frame arrival if needed
    await new Promise((r) => setTimeout(r, 400))
    const afterEvents = localApp.getWsEvents()
    const newFrames = afterEvents.length - beforeCount
    const latestEvent = afterEvents[0]?.payload
    return {
      status: r.status,
      ok: r.ok && newFrames > 0,
      note: `Triggered scenario; received ${newFrames} live WebSocket frame(s) (latest event=${latestEvent?.event || latestEvent?.type || 'HL7_ALERT'})`
    }
  })

  await timed('6. WebSockets & Local Health App', 'Emit Device Telemetry -> Real-Time WebSocket Broadcast', async () => {
    const beforeCount = localApp.getWsEvents().length
    const r = await rawFetch(`${apiUrl}/v1/environments/${envId}/devices/telemetry/emit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        patient_id: samplePatientId,
        device_type: 'multiparameter_icu_monitor',
        metrics: { heart_rate: 132, spo2: 88, map_mmhg: 58, temp_c: 39.1 }
      })
    })
    await new Promise((r) => setTimeout(r, 400))
    const afterEvents = localApp.getWsEvents()
    const newFrames = afterEvents.length - beforeCount
    return {
      status: r.status,
      ok: r.ok,
      note: `HTTP ${r.status}; new WebSocket frames=${newFrames} (total buffered=${afterEvents.length})`
    }
  })

  await timed('6. WebSockets & Local Health App', 'Local App GET /api/patients (Verify Persisted Triage Queue)', async () => {
    const r = await rawFetch(`${localBaseUrl}/api/patients`)
    return {
      status: r.status,
      ok: r.ok && r.json?.triageQueue?.length > 0,
      note: `patients=${r.json?.patients?.length}, triageQueue=${r.json?.triageQueue?.length}`
    }
  })

  // Test HebrahAgentHarness tool loop from @hebrah/sdk
  await timed('6. WebSockets & Local Health App', 'SDK HebrahAgentHarness.callTool("env_list") Session Check', async () => {
    const harness = new HebrahAgentHarness({
      mcpUrl,
      pat: apiKey
    })
    try {
      const res = await harness.callTool('env_list', {})
      return {
        status: 200,
        ok: true,
        note: `Returned ${JSON.stringify(res).slice(0, 80)}`
      }
    } catch (err) {
      findings.push({
        severity: 'High',
        area: '@hebrah/sdk (HebrahAgentHarness) vs hebrah-mcp-host',
        title: '`HebrahAgentHarness.callTool()` sends stateless `tools/call` without MCP `initialize` / `mcp-session-id`, failing with HTTP 400',
        detail: `hebrah-sdk-node/src/harness.ts:45 sends a direct POST tools/call without first calling 'initialize' to obtain 'mcp-session-id'. hebrah-mcp-host rejects stateless tools/call with HTTP 400: ${err.message}`
      })
      return {
        status: 400,
        ok: false,
        note: `SDK bug caught: ${err.message.slice(0, 120)}`
      }
    }
  })

  // -------------------------------------------------------------------------
  // PHASE 7: Audit Logs, Metering & Security Checks
  // -------------------------------------------------------------------------
  await timed('7. Security & Audit', 'SDK client.environments.logs() (Tamper-Evident Audit Trail)', async () => {
    const logs = await client.environments.logs(envId)
    return {
      status: 200,
      ok: Array.isArray(logs) && logs.length > 0,
      note: `${logs.length} audit log entries recorded`
    }
  })

  await timed('7. Security & Audit', 'Cross-Tenant BOLA/IDOR Isolation Check', async () => {
    const fakeEnvId = '00000000-0000-4000-8000-000000000001'
    try {
      await client.environments.get(fakeEnvId)
      return { status: 200, ok: false, note: 'Unexpected 200 on non-existent/foreign env' }
    } catch (err) {
      return {
        status: err.status,
        ok: err.status === 404,
        note: `Correctly isolated with HTTP ${err.status}`
      }
    }
  })

  await timed('7. Security & Audit', 'Zero-Leak Error Redaction Check (SDK redactSecrets)', async () => {
    const sampleLeak = `Error calling API with Bearer ${apiKey} and enc:v1:secret123`
    const scrubbed = redactSecrets(sampleLeak)
    const clean = !scrubbed.includes(apiKey) && !scrubbed.includes('secret123')
    return {
      status: 200,
      ok: clean,
      note: `Scrubbed output: "${scrubbed}"`
    }
  })

  const finalWallet = await timed('7. Security & Audit', 'Final Wallet Balance & Usage Metering Check', async () => {
    const w = await client.agent.wallet()
    const envDetail = await client.environments.get(envId)
    return {
      status: 200,
      ok: true,
      data: { wallet: w, env: envDetail },
      note: `balance=${w.balance_usd} (${w.balance_cents}c), queries_run=${envDetail.queries_run}, bytes_egressed=${envDetail.bytes_egressed}`
    }
  })

  // Pause environment after test so it doesn't burn runtime credits unnecessarily
  await timed('7. Security & Audit', 'SDK client.environments.pause() ($0.00/hr idle)', async () => {
    const paused = await client.environments.pause(envId)
    return {
      status: 200,
      ok: paused.status === 'paused' && paused.hourly_rate_cents === 0,
      note: `status=${paused.status}, hourly_rate_cents=${paused.hourly_rate_cents}`
    }
  })

  await localApp.close()

  // Compute latency statistics
  const latencies = metrics.map((m) => m.latencyMs).sort((a, b) => a - b)
  const sum = latencies.reduce((a, b) => a + b, 0)
  const avg = Number((sum / latencies.length).toFixed(1))
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  const max = latencies[latencies.length - 1]
  const min = latencies[0]

  const report = {
    generatedAt: new Date().toISOString(),
    wwwUrl: WWW_URL,
    apiUrl,
    appUrl,
    mcpUrl,
    agentAccount: {
      orgId,
      agentEmail,
      claimUrl,
      keyPrefix: `${apiKey.slice(0, 12)}...`
    },
    environmentId: envId,
    summaryStats: {
      totalChecks: metrics.length,
      passedChecks: metrics.filter((m) => m.ok).length,
      failedChecks: metrics.filter((m) => !m.ok).length,
      minLatencyMs: min,
      p50LatencyMs: p50,
      avgLatencyMs: avg,
      p95LatencyMs: p95,
      maxLatencyMs: max
    },
    metrics,
    findings
  }

  const outPath = path.join(__dirname, 'e2e-evaluation-results.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nSaved detailed JSON report to ${outPath}`)
  console.log(
    `Summary: ${report.summaryStats.passedChecks}/${report.summaryStats.totalChecks} passed | p50=${p50}ms | avg=${avg}ms | p95=${p95}ms | max=${max}ms`
  )
}

main().catch((err) => {
  console.error('Fatal error in agent E2E evaluation:', err)
  process.exit(1)
})
