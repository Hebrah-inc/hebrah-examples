import assert from 'node:assert/strict'
import { interpolateSqlParams } from '@hebrah/sdk'
import {
  OHS_QUESTIONNAIRE,
  buildFhirQuestionnaireResponse,
  evaluateOhsScreeningRisk,
  flattenPatientToSqlOnFhir
} from './ohs-sdc.mjs'
import {
   bootstrapOhsEnvironment,
  createOhsDemoServer,
  escapeHtml
} from './server.mjs'

async function runUnitChecks() {
  console.log('--- Phase 1: Open Health Stack (OHS) Local Unit & Schema Checks ---')

  assert.equal(OHS_QUESTIONNAIRE.resourceType, 'Questionnaire')
  assert.equal(OHS_QUESTIONNAIRE.id, 'ohs-community-cardiometabolic-screen-v1')
  assert.equal(OHS_QUESTIONNAIRE.item.length, 2)
  console.log('[PASS] 1.1 FHIR R4 Questionnaire structure & LOINC item definitions valid')

  const flatPatient = flattenPatientToSqlOnFhir({
    id: 'pat_01',
    mrn: 'MRN-1001',
    first_name: 'Amara',
    last_name: 'Okafor',
    dob: '1968-04-12',
    gender: 'female',
    department: 'Ambulatory Primary Care',
    acuity_level: 'high',
    primary_condition: 'Type 2 diabetes mellitus with hypertension'
  })
  assert.equal(flatPatient.patient_id, 'pat_01')
  assert.equal(flatPatient.fhir_reference, 'Patient/pat_01')
  assert.equal(flatPatient.full_name, 'Amara Okafor')
  console.log('[PASS] 1.2 FhirDataPipes patient flattener (ohs_patient_flat_view) valid')

  const highRisk = buildFhirQuestionnaireResponse({
    patientId: 'pat_01',
    patientName: 'Amara Okafor',
    systolicBp: 186,
    diastolicBp: 114,
    glucoseMgDl: 275,
    spo2Pct: 91,
    phq2Score: 4,
    sdohFlag: true
  })
  assert.equal(highRisk.fhirResource.resourceType, 'QuestionnaireResponse')
  assert.equal(highRisk.evaluation.riskTier, 'HIGH_URGENT_REFERRAL')
  assert.equal(highRisk.flatRow.risk_score, 100)
  assert.ok(JSON.parse(highRisk.flatRow.fhir_json).subject.reference === 'Patient/pat_01')
  console.log('[PASS] 1.3 High-risk QuestionnaireResponse builder + SQL-on-FHIR flat row valid')

  const lowRisk = evaluateOhsScreeningRisk({
    systolicBp: 118,
    diastolicBp: 76,
    glucoseMgDl: 92,
    spo2Pct: 99,
    phq2Score: 0,
    sdohFlag: false
  })
  assert.equal(lowRisk.riskTier, 'LOW_ROUTINE')
  assert.equal(lowRisk.riskScore, 0)
  console.log('[PASS] 1.4 WHO PEN / OHS low-risk stratification valid')

  // Verify HTTP server routes + HTML UI + AI Commons 5-check harness with an in-memory mock client
  const flatPatients = []
  const flatResponses = []
  const mockClient = {
    environments: {
      get: async () => ({
        id: 'env_ohs_test_01',
        name: 'OHS Community Clinic',
        clinic_type: 'ambulatory_clinic',
        status: 'active'
      })
    },
    agent: {
      wallet: async () => ({ balance_cents: 500, balance_usd: 5.0 })
    },
    db: {
      query: async (sql, params = []) => {
        const interpolated = interpolateSqlParams(String(sql), params)
        // Simulate SQLAlchemy text() bind parameter parser: (?<![:\w\x5c]):(\w+)(?!:)
        const bindMatch = interpolated.match(/(?<![:\w\\]):(\w+)(?!:)/)
        if (bindMatch) {
          throw new Error(
            `(sqlalchemy.exc.InvalidRequestError) A value is required for bind parameter '${bindMatch[1]}'`
          )
        }
        const normalized = String(sql).trim()
        if (/^DROP\s+TABLE/i.test(normalized) || /123-45-6789/.test(normalized)) {
          throw new Error('Blocked by Hebrah SQL AST / DLP Guardrail')
        }
        if (/FROM\s+patients/i.test(normalized)) {
          return {
            rows: [
              {
                id: 'pat_01',
                mrn: 'MRN-1001',
                first_name: 'Amara',
                last_name: 'Okafor',
                dob: '1968-04-12',
                gender: 'female',
                department: 'Ambulatory Primary Care',
                acuity_level: 'high',
                primary_condition: 'Type 2 diabetes mellitus with hypertension'
              }
            ]
          }
        }
        if (/INSERT\s+INTO\s+ohs_patient_flat_view/i.test(normalized)) {
          flatPatients.push({
            patient_id: params[0],
            mrn: params[1],
            full_name: params[2],
            gender: params[3],
            birth_date: params[4],
            department: params[5],
            acuity_level: params[6],
            primary_condition: params[7],
            fhir_reference: params[8],
            screening_count: flatResponses.length,
            max_risk_score: 100
          })
          return { rows: [] }
        }
        if (/INSERT\s+INTO\s+ohs_questionnaire_responses/i.test(normalized)) {
          flatResponses.push({
            response_id: params[0],
            patient_id: params[1],
            patient_name: params[2],
            questionnaire_url: params[3],
            systolic_bp: params[4],
            diastolic_bp: params[5],
            glucose_mg_dl: params[6],
            spo2_pct: params[7],
            phq2_score: params[8],
            sdoh_flag: params[9],
            risk_score: params[10],
            risk_tier: params[11],
            recommended_action: params[12],
            chw_notes: params[13],
            authored_at: params[14]
          })
          return { rows: [] }
        }
        if (/FROM\s+ohs_patient_flat_view/i.test(normalized)) {
          return { rows: flatPatients }
        }
        if (/GROUP\s+BY\s+risk_tier/i.test(normalized)) {
          return {
            rows: [
              {
                risk_tier: 'HIGH_URGENT_REFERRAL',
                total_screenings: flatResponses.length,
                avg_systolic_bp: 184,
                avg_glucose_mg_dl: 268,
                sdoh_positive_count: flatResponses.length
              }
            ]
          }
        }
        if (/FROM\s+ohs_questionnaire_responses/i.test(normalized)) {
          return { rows: flatResponses }
        }
        return { rows: [] }
      },
      recordOutcome: async (payload) => ({
        outcome: { id: 'out_ohs_01', ...payload }
      })
    }
  }

  const app = createOhsDemoServer({
    apiKey: 'hb_conn_test_token',
    baseUrl: 'https://api.hebrah.com',
    environmentId: 'env_ohs_test_01',
    client: mockClient
  })
  await app.ensureOhsSchema()
  const userPayloadSync = await app.syncQuestionnaireResponses([
    {
      patientId: 'pat-001',
      patientName: 'Eleanor Vance',
      systolicBp: 176,
      diastolicBp: 110,
      glucoseMgDl: 230,
      spo2Pct: 94,
      phq2Score: 3,
      sdohFlag: false
    }
  ])
  assert.equal(userPayloadSync.syncedCount, 1)
  assert.equal(userPayloadSync.results[0].patientId, 'pat-001')

  const evalReport = await app.runAiCommonsEvaluation()
  assert.equal(evalReport.allPassed, true)
  assert.equal(evalReport.passedCount, 5)
  console.log('[PASS] 1.5 In-memory 5/5 AI Commons evaluation checks & SQL-on-FHIR pipeline verified')

  // Security Sweep Checks (XSS escaping, patientId validation, clinical clamping)
  assert.equal(
    escapeHtml('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  )
  assert.throws(
    () => buildFhirQuestionnaireResponse({ patientId: 'pat_01; DROP TABLE patients;--' }),
    /Invalid patientId format/
  )
  const clamped = evaluateOhsScreeningRisk({
    systolicBp: 9999,
    diastolicBp: -50,
    glucoseMgDl: 9999,
    spo2Pct: 10,
    phq2Score: 99
  })
  assert.equal(clamped.riskScore, 100)
  console.log('[PASS] 1.6 Security hardening (HTML escaping, ID allowlist, clinical bounds clamping) verified')
}

async function runLiveIntegrationChecks() {
  console.log('\n--- Phase 2: Live Hebrah Isolated Health Environment + OHS E2E Checks ---')
  let apiKey = process.env.HEBRAH_API_KEY
  let baseUrl = process.env.HEBRAH_API_URL || 'https://api.hebrah.com'
  let environmentId = process.env.HEBRAH_ENV_ID || process.env.HEBRAH_ENVIRONMENT_ID

  if (!apiKey || !environmentId) {
    console.log('Bootstrapping isolated ambulatory_clinic + postgres environment via /SKILL.md...')
    const boot = await bootstrapOhsEnvironment()
    apiKey = boot.apiKey
    baseUrl = boot.baseUrl
    environmentId = boot.environmentId
    console.log(`[PASS] 2.1 Provisioned environment ${environmentId}`)
  }

  const app = createOhsDemoServer({ apiKey, baseUrl, environmentId })
  await app.ensureOhsSchema()

  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve))
  const { port } = app.server.address()

  try {
    const qRes = await fetch(`http://127.0.0.1:${port}/api/questionnaire`).then((r) => r.json())
    assert.equal(qRes.id, 'ohs-community-cardiometabolic-screen-v1')
    console.log('[PASS] 2.2 GET /api/questionnaire returned FHIR R4 Questionnaire')

    const report = await fetch(`http://127.0.0.1:${port}/api/ai-commons/evaluate`, {
      method: 'POST'
    }).then((r) => r.json())

    for (const check of report.checks || []) {
      console.log(`[${check.passed ? 'PASS' : 'FAIL'}] ${check.id}: ${check.title}`)
      assert.equal(check.passed, true, `Failed check ${check.id}: ${JSON.stringify(check.detail)}`)
    }
    assert.equal(report.allPassed, true)
    console.log(
      `[PASS] 2.3 All ${report.passedCount}/${report.totalCount} OHS AI Commons & SQL-on-FHIR checks passed`
    )
  } finally {
    await app.close()
  }
}

await runUnitChecks()

if (!process.argv.includes('--unit')) {
  try {
    await runLiveIntegrationChecks()
  } catch (err) {
    if (
      String(err?.cause?.code || err?.code || err?.message || '').match(
        /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|EPERM|fetch failed/i
      )
    ) {
      console.log(
        '\n[INFO] Network sandbox detected during live staging check; unit verification passed (5/5). Run with network access to execute live staging E2E.'
      )
    } else {
      throw err
    }
  }
}
