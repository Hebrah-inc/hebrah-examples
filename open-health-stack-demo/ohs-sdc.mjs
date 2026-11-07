/**
 * Open Health Stack (OHS) Pillars 1 & 2 Helper Module:
 * - Pillar 1 (FHIR Foundations / Structured Data Capture):
 *   Standard HL7 FHIR R4 `Questionnaire` (`ohs-community-cardiometabolic-screen-v1`)
 *   and `QuestionnaireResponse` builder + WHO/OHS clinical risk stratification.
 * - Pillar 2 (FhirDataPipes / SQL-on-FHIR):
 *   Extracts and flattens FHIR R4 `Patient` + `QuestionnaireResponse` resources
 *   into relational rows for the environment's attached PostgreSQL 16 module.
 */

export const OHS_QUESTIONNAIRE = Object.freeze({
  resourceType: 'Questionnaire',
  id: 'ohs-community-cardiometabolic-screen-v1',
  url: 'https://ohs.foundation/fhir/Questionnaire/ohs-community-cardiometabolic-screen-v1',
  version: '1.0.0',
  name: 'OHSCommunityCardiometabolicScreen',
  title: 'OHS Community Health & Cardiometabolic Risk Screening (FHIR R4 SDC)',
  status: 'active',
  subjectType: ['Patient'],
  description:
    'Standardized offline-capable FHIR R4 Structured Data Capture (SDC) instrument modeled on Open Health Stack (ohs.foundation) and WHO PEN primary-care screening protocols.',
  item: [
    {
      linkId: 'vitals-group',
      text: '1. Point-of-Care Vital Signs & Glycemic Check',
      type: 'group',
      item: [
        {
          linkId: 'systolic_bp',
          code: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }],
          text: 'Systolic Blood Pressure (mmHg)',
          type: 'integer',
          required: true
        },
        {
          linkId: 'diastolic_bp',
          code: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }],
          text: 'Diastolic Blood Pressure (mmHg)',
          type: 'integer',
          required: true
        },
        {
          linkId: 'glucose_mg_dl',
          code: [{ system: 'http://loinc.org', code: '2339-0', display: 'Glucose [Mass/volume] in Blood' }],
          text: 'Point-of-Care Blood Glucose (mg/dL)',
          type: 'integer',
          required: true
        },
        {
          linkId: 'spo2_pct',
          code: [{ system: 'http://loinc.org', code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' }],
          text: 'Pulse Oximetry SpO2 (%)',
          type: 'integer',
          required: true
        }
      ]
    },
    {
      linkId: 'behavioral-sdoh-group',
      text: '2. PHQ-2 Behavioral & Social Determinants (SDOH) Screen',
      type: 'group',
      item: [
        {
          linkId: 'phq2_score',
          code: [{ system: 'http://loinc.org', code: '55758-7', display: 'Patient Health Questionnaire 2 item (PHQ-2) total score' }],
          text: 'PHQ-2 Depression Screen Score (0–6)',
          type: 'integer',
          required: true
        },
        {
          linkId: 'sdoh_flag',
          code: [{ system: 'http://loinc.org', code: '93033-9', display: 'Food or housing insecurity risk' }],
          text: 'Food, medication access, or housing instability reported (ICD-10 Z59/Z60)',
          type: 'boolean',
          required: true
        },
        {
          linkId: 'chw_notes',
          text: 'Community Health Worker (CHW) Field Notes',
          type: 'string',
          required: false
        }
      ]
    }
  ]
})

/**
 * Formats JSON and text strings so that no colon is immediately followed by an
 * identifier/number after a non-word character (e.g. `"valueInteger":176`), which
 * SQLAlchemy `text()` on the control plane would otherwise misinterpret as a `:176`
 * named bind parameter.
 */
export function toSqlSafeJson(value) {
  return JSON.stringify(value).replace(/(?<![:\w]):(\w+)/g, ': $1')
}

export function sanitizeSqlText(value) {
  return String(value ?? '').replace(/(?<![:\w]):(\w+)/g, ': $1')
}

export const SAFE_ID_RE = /^[A-Za-z0-9._:-]{1,64}$/

function clampInt(val, fallback, min, max) {
  const num = Number(val ?? fallback)
  if (!Number.isFinite(num)) return fallback
  return Math.max(min, Math.min(max, Math.round(num)))
}

/**
 * Evaluates WHO / OHS primary-care risk tier and clinical action from screening answers.
 */
export function evaluateOhsScreeningRisk({
  systolicBp,
  diastolicBp,
  glucoseMgDl,
  spo2Pct,
  phq2Score,
  sdohFlag
}) {
  const sbp = clampInt(systolicBp, 120, 40, 300)
  const dbp = clampInt(diastolicBp, 80, 20, 200)
  const glucose = clampInt(glucoseMgDl, 95, 20, 1000)
  const spo2 = clampInt(spo2Pct, 98, 50, 100)
  const phq2 = clampInt(phq2Score, 0, 0, 6)
  const sdoh = Boolean(sdohFlag)

  let riskScore = 0
  const triggers = []

  if (sbp >= 180 || dbp >= 120) {
    riskScore += 50
    triggers.push(`Hypertensive crisis (${sbp}/${dbp} mmHg)`)
  } else if (sbp >= 140 || dbp >= 90) {
    riskScore += 25
    triggers.push(`Stage 2 hypertension (${sbp}/${dbp} mmHg)`)
  }

  if (glucose >= 250) {
    riskScore += 35
    triggers.push(`Severe hyperglycemia (${glucose} mg/dL)`)
  } else if (glucose >= 140) {
    riskScore += 15
    triggers.push(`Elevated blood glucose (${glucose} mg/dL)`)
  }

  if (spo2 < 92) {
    riskScore += 45
    triggers.push(`Hypoxemia alert (SpO2 ${spo2}%)`)
  } else if (spo2 < 95) {
    riskScore += 15
    triggers.push(`Borderline SpO2 (${spo2}%)`)
  }

  if (phq2 >= 3) {
    riskScore += 20
    triggers.push(`Positive PHQ-2 screen (${phq2}/6 -> administer PHQ-9)`)
  }

  if (sdoh) {
    riskScore += 15
    triggers.push('Positive SDOH barrier (Z59/Z60 social work referral)')
  }

  let riskTier = 'LOW_ROUTINE'
  let recommendedAction = 'Continue routine annual WHO PEN / OHS community wellness follow-up'

  if (riskScore >= 50) {
    riskTier = 'HIGH_URGENT_REFERRAL'
    recommendedAction =
      'URGENT: Escalate to clinic physician immediately; initiate antihypertensive/glycemic stabilization & CHW acute navigation'
  } else if (riskScore >= 25) {
    riskTier = 'MODERATE_CHW_FOLLOWUP'
    recommendedAction =
      'Schedule 7-day ambulatory follow-up, medication adherence review, and social work / behavioral health check'
  }

  return {
    riskScore: Math.min(100, riskScore),
    riskTier,
    triggers,
    recommendedAction
  }
}

/**
 * Builds a standards-compliant HL7 FHIR R4 `QuestionnaireResponse` resource
 * and computes its flattened SQL-on-FHIR relational row.
 */
export function buildFhirQuestionnaireResponse(input) {
  const rawResponseId =
    input.responseId || `qr-ohs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const responseId = String(rawResponseId).trim()
  if (!SAFE_ID_RE.test(responseId)) {
    throw new Error('Invalid responseId format')
  }
  const patientId = String(input.patientId ?? '').trim()
  if (!SAFE_ID_RE.test(patientId)) {
    throw new Error('Invalid patientId format')
  }
  const patientName = String(input.patientName || patientId).slice(0, 120)
  const authored = String(input.authored || new Date().toISOString()).slice(0, 40)

  const systolicBp = clampInt(input.systolicBp, 168, 40, 300)
  const diastolicBp = clampInt(input.diastolicBp, 102, 20, 200)
  const glucoseMgDl = clampInt(input.glucoseMgDl, 215, 20, 1000)
  const spo2Pct = clampInt(input.spo2Pct, 95, 50, 100)
  const phq2Score = clampInt(input.phq2Score, 3, 0, 6)
  const sdohFlag = Boolean(input.sdohFlag ?? true)
  const chwNotes = String(
    input.chwNotes ||
      'Captured via OHS offline-first field queue; patient reported missed amlodipine refill due to transit barrier.'
  ).slice(0, 500)

  const evaluation = evaluateOhsScreeningRisk({
    systolicBp,
    diastolicBp,
    glucoseMgDl,
    spo2Pct,
    phq2Score,
    sdohFlag
  })

  const fhirResource = {
    resourceType: 'QuestionnaireResponse',
    id: responseId,
    questionnaire: OHS_QUESTIONNAIRE.url,
    status: 'completed',
    subject: {
      reference: `Patient/${patientId}`,
      display: patientName
    },
    authored,
    item: [
      {
        linkId: 'vitals-group',
        text: '1. Point-of-Care Vital Signs & Glycemic Check',
        item: [
          { linkId: 'systolic_bp', answer: [{ valueInteger: systolicBp }] },
          { linkId: 'diastolic_bp', answer: [{ valueInteger: diastolicBp }] },
          { linkId: 'glucose_mg_dl', answer: [{ valueInteger: glucoseMgDl }] },
          { linkId: 'spo2_pct', answer: [{ valueInteger: spo2Pct }] }
        ]
      },
      {
        linkId: 'behavioral-sdoh-group',
        text: '2. PHQ-2 Behavioral & Social Determinants (SDOH) Screen',
        item: [
          { linkId: 'phq2_score', answer: [{ valueInteger: phq2Score }] },
          { linkId: 'sdoh_flag', answer: [{ valueBoolean: sdohFlag }] },
          { linkId: 'chw_notes', answer: [{ valueString: chwNotes }] }
        ]
      }
    ]
  }

  const flatRow = {
    response_id: responseId,
    patient_id: patientId,
    patient_name: sanitizeSqlText(patientName),
    questionnaire_url: OHS_QUESTIONNAIRE.url,
    systolic_bp: systolicBp,
    diastolic_bp: diastolicBp,
    glucose_mg_dl: glucoseMgDl,
    spo2_pct: spo2Pct,
    phq2_score: phq2Score,
    sdoh_flag: sdohFlag,
    risk_score: evaluation.riskScore,
    risk_tier: evaluation.riskTier,
    recommended_action: sanitizeSqlText(evaluation.recommendedAction),
    chw_notes: sanitizeSqlText(chwNotes),
    authored_at: authored,
    fhir_json: toSqlSafeJson(fhirResource)
  }

  return {
    fhirResource,
    flatRow,
    evaluation
  }
}

/**
 * Flattens a Hebrah patient row / FHIR Patient resource into a SQL-on-FHIR flat row
 * (`ohs_patient_flat_view` schema).
 */
export function flattenPatientToSqlOnFhir(patient) {
  const id = String(patient.id || patient.patient_id || '')
  const mrn = String(patient.mrn || `MRN-${id}`)
  const firstName = String(patient.first_name || patient.givenName || 'Synthetic')
  const lastName = String(patient.last_name || patient.familyName || 'Patient')
  const fullName = `${firstName} ${lastName}`.trim()
  const gender = String(patient.gender || 'unknown')
  const birthDate = String(patient.dob || patient.birth_date || '1970-01-01')
  const department = String(patient.department || 'Ambulatory Primary Care')
  const acuityLevel = String(patient.acuity_level || 'moderate')
  const primaryCondition = String(patient.primary_condition || 'Essential hypertension')

  return {
    patient_id: id,
    mrn,
    full_name: fullName,
    gender,
    birth_date: birthDate,
    department,
    acuity_level: acuityLevel,
    primary_condition: primaryCondition,
    fhir_reference: `Patient/${id}`
  }
}
