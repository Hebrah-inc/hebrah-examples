import http from 'node:http'
import { HebrahClient, redactSecrets } from '../../hebrah-sdk-node/dist/index.js'

/**
 * Creates a local Node.js Clinical Sepsis & Telemetry Health Application
 * powered by @hebrah/sdk, the Isolated Environment PostgreSQL 16 add-on,
 * and Hebrah's real-time HL7 v2 WebSocket stream.
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
        // Node 22/24 global WebSocket supports headers option via undici
        upstreamWs = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        })
      } catch {
        // Fallback if headers option is not supported in a browser-like WS implementation
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
        const env = await client.environments.get()
        const wallet = await client.agent.wallet()
        return sendJson(res, 200, {
          status: 'ok',
          environmentId: env.id,
          environmentName: env.name,
          clinicType: env.clinic_type,
          patientCohort: env.patient_cohort,
          envStatus: env.status,
          walletBalanceCents: wallet.balance_cents,
          walletBalanceUsd: wallet.balance_usd ?? Number(((wallet.balance_cents ?? 0) / 100).toFixed(2)),
          wsConnected,
          wsLastPongAt,
          wsEventsBuffered: wsEvents.length
        })
      }

      if (req.method === 'GET' && url.pathname === '/api/patients') {
        const dbRes = await client.db.query(`
          SELECT id, mrn, first_name, last_name, dob, gender, department, acuity_level, primary_condition, status
          FROM patients
          ORDER BY id ASC
          LIMIT 15
        `)
        const queueRes = await client.db.query(`
          SELECT queue_id, patient_id, patient_name, department, qsofa_score, lactate_mmol, triage_status, recommended_action, created_at
          FROM sepsis_triage_queue
          ORDER BY created_at DESC
          LIMIT 10
        `)
        return sendJson(res, 200, {
          patients: dbRes.rows,
          triageQueue: queueRes.rows
        })
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
        const triageStatus = qsofaScore >= 2 || lactateMmol >= 2.0 ? 'CRITICAL_SEPSIS_ALERT' : 'STABLE_WATCH'
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
  <title>Hebrah Local Node.js Clinical Sepsis & Telemetry App</title>
</head>
<body>
  <h1>Hebrah Local Node.js Clinical Sepsis & Telemetry App</h1>
  <p>Environment ID: <code>${environmentId}</code></p>
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
  const apiKey = process.env.HEBRAH_API_KEY
  const baseUrl = process.env.HEBRAH_API_URL || 'https://hebrah-staging-api-76zyj6ngda-uc.a.run.app'
  const environmentId = process.env.HEBRAH_ENV_ID
  const port = Number(process.env.PORT || 4040)

  if (!apiKey || !environmentId) {
    console.error('Usage: HEBRAH_API_KEY=hb_... HEBRAH_ENV_ID=... node server.mjs')
    process.exit(1)
  }

  const app = createHealthAppServer({ apiKey, baseUrl, environmentId })
  await app.ensureAppSchema()
  await app.connectUpstreamWebSocket()
  app.server.listen(port, '127.0.0.1', () => {
    console.log(`Hebrah Local Health App listening at http://127.0.0.1:${port}`)
  })
}
