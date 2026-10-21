import http from 'node:http'
import { HebrahClient, redactSecrets } from '@hebrah/sdk'

/**
 * Discovers Hebrah endpoints from `/SKILL.md`, registers a headless agent account
 * ($5.00 free trial credit), and provisions an ICU Critical Care + PostgreSQL 16
 * isolated health environment when credentials are not already provided.
 */
export async function bootstrapFromSkillMd(
  wwwUrl = process.env.WWW_URL || 'https://hebrah-staging-www-76zyj6ngda-uc.a.run.app'
) {
  const skillRes = await fetch(`${wwwUrl.replace(/\/$/, '')}/SKILL.md`)
  if (!skillRes.ok) {
    throw new Error(`Failed to fetch SKILL.md (${skillRes.status})`)
  }
  const skillText = await skillRes.text()
  const apiUrlMatch = skillText.match(/\*\*API Control Plane \(`apiUrl`\)\*\*:\s*`([^`]+)`/)
  const baseUrl =
    process.env.HEBRAH_API_URL ||
    (apiUrlMatch ? apiUrlMatch[1] : 'https://hebrah-staging-api-76zyj6ngda-uc.a.run.app')

  const ts = Date.now()
  const regRes = await fetch(`${baseUrl}/v1/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_name: `Hebrah Demo App ${ts}`,
      agent_name: `icu-sepsis-demo-${ts}`,
      contact_email: `demo-${ts}@hebrah.com`
    })
  })
  if (!regRes.ok) {
    throw new Error(`Agent self-registration failed (${regRes.status}): ${await regRes.text()}`)
  }
  const regData = await regRes.json()
  const apiKey = regData.apiKey || regData.api_key

  const client = new HebrahClient({ apiKey, baseUrl })
  const env = await client.environments.create({
    name: 'ICU Sepsis & Real-Time Telemetry Demo',
    archetype: 'icu_critical_care',
    addons: ['postgres'],
    seed_patients: 12
  })

  return {
    apiKey,
    baseUrl,
    environmentId: env.id,
    claimUrl: regData.claimUrl || regData.claim_url
  }
}

/**
 * Creates a local Node.js Clinical Sepsis & Telemetry Health Application
 * powered by `@hebrah/sdk` (v0.9.2), the Isolated Environment PostgreSQL 16 add-on,
 * and Hebrah's real-time HL7 v2 + IEEE 11073 WebSocket stream.
 */
export function createHealthAppServer({ apiKey, baseUrl, environmentId }) {
  const client = new HebrahClient({
    apiKey,
    baseUrl,
    environmentId
  })

  const wsEvents = []
  let upstreamWs = null
  let wsConnected = false
  let wsLastPongAt = null

  function connectUpstreamWebSocket() {
    return new Promise((resolve) => {
      const wsBase = baseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
      const wsUrl = `${wsBase}/v1/environments/${encodeURIComponent(environmentId)}/ws`

      let resolved = false
      const done = (ok, info) => {
        if (!resolved) {
          resolved = true
          resolve({ connected: ok, info })
        }
      }

      try {
        upstreamWs = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        })
      } catch {
        upstreamWs = new WebSocket(`${wsUrl}?token=${encodeURIComponent(apiKey)}`)
      }

      const timeout = setTimeout(() => {
        done(wsConnected, 'timeout waiting for CONNECTED greeting')
      }, 6000)

      upstreamWs.addEventListener('open', () => {
        wsConnected = true
      })

      upstreamWs.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data))
          wsEvents.unshift({
            receivedAt: new Date().toISOString(),
            payload
          })
          if (wsEvents.length > 50) wsEvents.pop()

          if (payload.event === 'CONNECTED') {
            clearTimeout(timeout)
            done(true, payload)
          } else if (payload.event === 'PONG') {
            wsLastPongAt = payload.timestamp || new Date().toISOString()
          }
        } catch {
          wsEvents.unshift({
            receivedAt: new Date().toISOString(),
            payload: { raw: String(event.data) }
          })
        }
      })

      upstreamWs.addEventListener('error', (err) => {
        clearTimeout(timeout)
        done(false, redactSecrets(String(err?.message || 'WebSocket error')))
      })

      upstreamWs.addEventListener('close', () => {
        wsConnected = false
      })
    })
  }

  function pingUpstreamWebSocket() {
    return new Promise((resolve) => {
      if (!upstreamWs || !wsConnected) {
        resolve({ ok: false, error: 'WebSocket not connected' })
        return
      }
      const start = performance.now()
      const onMsg = (event) => {
        try {
          const data = JSON.parse(String(event.data))
          if (data.event === 'PONG') {
            upstreamWs.removeEventListener('message', onMsg)
            resolve({
              ok: true,
              latencyMs: Number((performance.now() - start).toFixed(1)),
              timestamp: data.timestamp
            })
          }
        } catch {
          // ignore non-JSON
        }
      }
      upstreamWs.addEventListener('message', onMsg)
      upstreamWs.send(JSON.stringify({ action: 'ping' }))
      setTimeout(() => {
        upstreamWs?.removeEventListener('message', onMsg)
        resolve({ ok: false, error: 'PONG timeout' })
      }, 4000)
    })
  }

  async function ensureAppSchema() {
    await client.db.query(`
      CREATE TABLE IF NOT EXISTS sepsis_triage_queue (
        queue_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        department TEXT NOT NULL,
        qsofa_score INTEGER NOT NULL,
        lactate_mmol NUMERIC(5,2),
        triage_status TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  }

  async function readJsonBody(req) {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  }

  function sendJson(res, status, data) {
    const body = JSON.stringify(data, null, 2)
    res.writeHead(status, {
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
          patientCohort: env.patient_cohort,
          envStatus: env.status,
          walletBalanceCents: wallet.balance_cents,
          walletBalanceUsd:
            wallet.balance_usd ?? Number(((wallet.balance_cents ?? 0) / 100).toFixed(2)),
          wsConnected,
          wsLastPongAt,
          wsEventsBuffered: wsEvents.length
        })
      }

      if (req.method === 'GET' && url.pathname === '/api/patients') {
        const [dbRes, queueRes] = await Promise.all([
          client.db.query(`
            SELECT id, mrn, first_name, last_name, dob, gender, department, acuity_level, primary_condition, status
            FROM patients
            ORDER BY id ASC
            LIMIT 15
          `),
          client.db.query(`
            SELECT queue_id, patient_id, patient_name, department, qsofa_score, lactate_mmol, triage_status, recommended_action, created_at
            FROM sepsis_triage_queue
            ORDER BY created_at DESC
            LIMIT 10
          `)
        ])
        return sendJson(res, 200, {
          patients: dbRes.rows,
          triageQueue: queueRes.rows
        })
      }

      if (req.method === 'GET' && url.pathname === '/api/chart') {
        const patientId = url.searchParams.get('patientId')
        if (!patientId) {
          return sendJson(res, 400, { error: 'patientId query parameter is required' })
        }
        const chart = await client.environments.getPatientChart(environmentId, patientId)
        return sendJson(res, 200, chart)
      }

      if (req.method === 'POST' && url.pathname === '/api/triage') {
        const body = await readJsonBody(req)
        const patientId = body.patientId
        if (!patientId) {
          return sendJson(res, 400, { error: 'patientId is required' })
        }

        const patRes = await client.db.query(
          'SELECT id, first_name, last_name, department, acuity_level, primary_condition FROM patients WHERE id = $1 LIMIT 1',
          [patientId]
        )
        const patient = patRes.rows[0]
        if (!patient) {
          return sendJson(res, 404, { error: `Patient ${patientId} not found` })
        }

        const qsofaScore = Number(body.qsofaScore ?? 3)
        const lactateMmol = Number(body.lactateMmol ?? 4.2)
        const triageStatus =
          qsofaScore >= 2 || lactateMmol >= 2.0 ? 'CRITICAL_SEPSIS_ALERT' : 'STABLE_WATCH'
        const recommendedAction =
          triageStatus === 'CRITICAL_SEPSIS_ALERT'
            ? 'Initiate Surviving Sepsis 1-Hour Bundle: blood cultures, broad-spectrum IV antibiotics, 30mL/kg crystalloid bolus'
            : 'Continue routine q4h vitals monitoring'

        const queueId = `triage-${Date.now().toString(36)}`
        const fullName = `${patient.first_name} ${patient.last_name}`

        // 1. Write directly into custom Postgres add-on table
        await client.db.query(
          `INSERT INTO sepsis_triage_queue
            (queue_id, patient_id, patient_name, department, qsofa_score, lactate_mmol, triage_status, recommended_action)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            queueId,
            String(patient.id),
            fullName,
            String(patient.department || 'ICU'),
            qsofaScore,
            lactateMmol,
            triageStatus,
            recommendedAction
          ]
        )

        // 2. Record official structured agent outcome in app_outcomes
        const outcomeRes = await client.db.recordOutcome({
          patientId: String(patient.id),
          outcomeType: 'sepsis_qsofa_triage',
          sourceAgent: 'local-node-health-app',
          score: qsofaScore * 30,
          summary: `${triageStatus} for ${fullName}: qSOFA=${qsofaScore}, Lactate=${lactateMmol} mmol/L`,
          payload: {
            queue_id: queueId,
            qsofa_score: qsofaScore,
            lactate_mmol: lactateMmol,
            recommended_action: recommendedAction
          }
        })

        return sendJson(res, 201, {
          queueId,
          patientId: patient.id,
          patientName: fullName,
          triageStatus,
          qsofaScore,
          lactateMmol,
          recommendedAction,
          outcome: outcomeRes.outcome
        })
      }

      if (req.method === 'POST' && url.pathname === '/api/scenario') {
        const body = await readJsonBody(req)
        const scenario = body.scenario || 'icu_sepsis_deterioration'
        const result = await client.environments.triggerScenario({
          scenario,
          patient_id: body.patientId
        })
        return sendJson(res, 200, result)
      }

      if (req.method === 'POST' && url.pathname === '/api/studio') {
        const body = await readJsonBody(req)
        const prompt = body.prompt || 'Summarize our ICU critical care sepsis cohort and top risks'
        const studioRes = await client.environments.consultStudio(environmentId, {
          prompt,
          auto_run_tools: true
        })
        return sendJson(res, 200, studioRes)
      }

      if (req.method === 'GET' && url.pathname === '/api/ws-events') {
        return sendJson(res, 200, {
          wsConnected,
          wsLastPongAt,
          events: wsEvents
        })
      }

      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hebrah ICU Sepsis & Telemetry Command Center (@hebrah/sdk v0.9.2)</title>
  <style>
    :root {
      --bg: #FAF8F6;
      --card: #FFFFFF;
      --border: #E5E0D8;
      --text: #1A1714;
      --muted: #696259;
      --accent: #0F766E;
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
    .badge.ok { background: #CCFBF1; color: #115E59; }
    .grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
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
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--muted); font-weight: 500; font-size: 12px; }
    button {
      background: var(--accent);
      color: #fff;
      border: 0;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    button.secondary {
      background: #EFECE6;
      color: var(--text);
    }
    pre {
      background: #141210;
      color: #E7E2DA;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      overflow-x: auto;
      max-height: 280px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Hebrah ICU Sepsis & Telemetry Command Center</h1>
      <div class="subtitle">Environment ID: <code>${environmentId}</code> · Powered by <code>@hebrah/sdk@0.9.2</code> + PostgreSQL 16 + HL7 v2 WSS</div>
    </div>
    <div class="badges" id="status-badges">
      <span class="badge">Loading status...</span>
    </div>
  </header>

  <div class="grid">
    <div>
      <div class="card">
        <h2>
          <span>ICU Cohort (PostgreSQL 16 <code>patients</code>)</span>
          <button class="secondary" onclick="refreshAll()">Refresh</button>
        </h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Patient</th>
              <th>Dept / Acuity</th>
              <th>Condition</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="patients-tbody"></tbody>
        </table>
      </div>

      <div class="card">
        <h2>Persisted Sepsis Triage Queue (Custom Table <code>sepsis_triage_queue</code>)</h2>
        <table>
          <thead>
            <tr>
              <th>Queue ID</th>
              <th>Patient</th>
              <th>qSOFA</th>
              <th>Lactate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="triage-tbody"></tbody>
        </table>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>
          <span>Real-Time HL7 v2 & IEEE 11073 WebSocket Stream</span>
          <button onclick="triggerScenario()">Trigger ICU Sepsis Alert</button>
        </h2>
        <pre id="ws-feed">Connecting to WebSocket stream...</pre>
      </div>

      <div class="card">
        <h2>Selected Patient 5-Tab EHR Chart / AI Studio Output</h2>
        <pre id="inspector-box">Click "Chart" or "Triage" on any patient row to inspect clinical records.</pre>
      </div>
    </div>
  </div>

  <script>
    async function refreshAll() {
      const [health, patData, wsData] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/patients').then(r => r.json()),
        fetch('/api/ws-events').then(r => r.json())
      ]);

      document.getElementById('status-badges').innerHTML = [
        '<span class="badge ok">Env: ' + health.envStatus + ' (' + health.clinicType + ')</span>',
        '<span class="badge ' + (health.wsConnected ? 'ok' : '') + '">WSS: ' + (health.wsConnected ? 'CONNECTED' : 'DISCONNECTED') + '</span>',
        '<span class="badge">Wallet: $' + health.walletBalanceUsd + '</span>'
      ].join('');

      document.getElementById('patients-tbody').innerHTML = (patData.patients || []).map(p => (
        '<tr>' +
          '<td><code>' + p.id + '</code></td>' +
          '<td><strong>' + p.first_name + ' ' + p.last_name + '</strong><br/><small>' + p.gender + ' · ' + (p.dob || p.birth_date || '') + '</small></td>' +
          '<td>' + (p.department || 'ICU') + ' / ' + (p.acuity_level || 'high') + '</td>' +
          '<td>' + (p.primary_condition || '') + '</td>' +
          '<td>' +
            '<button onclick="runTriage(\\'' + p.id + '\\')">Triage (PG Write)</button> ' +
            '<button class="secondary" onclick="viewChart(\\'' + p.id + '\\')">Chart</button>' +
          '</td>' +
        '</tr>'
      )).join('');

      document.getElementById('triage-tbody').innerHTML = (patData.triageQueue || []).map(q => (
        '<tr>' +
          '<td><code>' + q.queue_id + '</code></td>' +
          '<td>' + q.patient_name + '</td>' +
          '<td>' + q.qsofa_score + '</td>' +
          '<td>' + q.lactate_mmol + ' mmol/L</td>' +
          '<td><strong>' + q.triage_status + '</strong></td>' +
        '</tr>'
      )).join('') || '<tr><td colspan="5">No triage entries yet.</td></tr>';

      document.getElementById('ws-feed').textContent = JSON.stringify(wsData.events || [], null, 2);
    }

    async function runTriage(patientId) {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, qsofaScore: 3, lactateMmol: 4.6 })
      }).then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(res, null, 2);
      await refreshAll();
    }

    async function viewChart(patientId) {
      const res = await fetch('/api/chart?patientId=' + encodeURIComponent(patientId)).then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(res, null, 2);
    }

    async function triggerScenario() {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'icu_sepsis_deterioration' })
      }).then(r => r.json());
      document.getElementById('inspector-box').textContent = JSON.stringify(res, null, 2);
      setTimeout(refreshAll, 500);
    }

    refreshAll();
    setInterval(refreshAll, 5000);
  </script>
</body>
</html>`)
        return
      }

      return sendJson(res, 404, { error: 'Not found' })
    } catch (err) {
      return sendJson(res, 500, {
        error: redactSecrets(String(err?.message || err))
      })
    }
  })

  return {
    server,
    client,
    connectUpstreamWebSocket,
    pingUpstreamWebSocket,
    ensureAppSchema,
    getWsEvents: () => wsEvents,
    close: () => {
      try {
        upstreamWs?.close()
      } catch {
        // ignore
      }
      return new Promise((resolve) => server.close(() => resolve()))
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let apiKey = process.env.HEBRAH_API_KEY
  let baseUrl = process.env.HEBRAH_API_URL || 'https://hebrah-staging-api-76zyj6ngda-uc.a.run.app'
  let environmentId = process.env.HEBRAH_ENV_ID || process.env.HEBRAH_ENVIRONMENT_ID
  const port = Number(process.env.PORT || 3013)

  if (!apiKey || !environmentId) {
    console.log('No HEBRAH_API_KEY / HEBRAH_ENV_ID provided — bootstrapping automatically via /SKILL.md...')
    const boot = await bootstrapFromSkillMd()
    apiKey = boot.apiKey
    baseUrl = boot.baseUrl
    environmentId = boot.environmentId
    console.log(`Provisioned Isolated ICU Environment: ${environmentId}`)
    if (boot.claimUrl) {
      console.log(`Claim Organization URL ($5.00 Free Trial): ${boot.claimUrl}`)
    }
  }

  const app = createHealthAppServer({ apiKey, baseUrl, environmentId })
  await app.ensureAppSchema()
  await app.connectUpstreamWebSocket()
  app.server.listen(port, '127.0.0.1', () => {
    console.log(`Hebrah Local Health App listening at http://127.0.0.1:${port}`)
  })
}
