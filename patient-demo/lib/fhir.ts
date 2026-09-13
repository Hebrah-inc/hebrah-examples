export interface FhirHumanName {
  family?: string
  given?: string[]
}

export interface FhirIdentifier {
  system?: string
  value?: string
  use?: string
}

export interface FhirPatient {
  resourceType?: string
  id?: string
  name?: FhirHumanName[]
  gender?: string
  birthDate?: string
  identifier?: FhirIdentifier[]
  telecom?: Array<{ system?: string, value?: string }>
  address?: Array<{
    line?: string[]
    city?: string
    state?: string
    postalCode?: string
  }>
  managingOrganization?: { display?: string }
}

export interface FhirHumanName {
  family?: string
  given?: string[]
}

export interface FhirIdentifier {
  system?: string
  value?: string
  use?: string
}

export interface FhirExtension {
  url?: string
  valueString?: string
  valueBoolean?: boolean
  valueDecimal?: number
}

export interface FhirPatient {
  resourceType?: string
  id?: string
  name?: FhirHumanName[]
  gender?: string
  birthDate?: string
  identifier?: FhirIdentifier[]
  telecom?: Array<{ system?: string, value?: string }>
  address?: Array<{
    line?: string[]
    city?: string
    state?: string
    postalCode?: string
  }>
  managingOrganization?: { display?: string }
  extension?: FhirExtension[]
}

export interface FhirMedicationRequest {
  resourceType?: string
  id?: string
  status?: string // 'active' | 'completed' | 'stopped'
  intent?: string
  authoredOn?: string
  medicationCodeableConcept?: {
    coding?: Array<{ system?: string, code?: string, display?: string }>
    text?: string
  }
  subject?: { reference?: string, display?: string }
  dosageInstruction?: Array<{
    text?: string
    route?: { text?: string }
  }>
  dispenseRequest?: {
    numberOfRepeatsAllowed?: number
    quantity?: { value?: number, unit?: string }
    expectedSupplyDuration?: { value?: number, unit?: string }
  }
  priorPrescription?: {
    reference?: string
    display?: string
  }
  statusReason?: {
    coding?: Array<{ system?: string, code?: string, display?: string }>
    text?: string
  }
  department?: string
  period?: string
  period_quarter?: string
}

export interface FhirObservation {
  resourceType?: string
  id?: string
  status?: string
  code?: {
    coding?: Array<{ system?: string, code?: string, display?: string }>
    text?: string
  }
  subject?: { reference?: string, display?: string }
  effectiveDateTime?: string
  valueQuantity?: {
    value?: number
    unit?: string
  }
  referenceRange?: Array<{
    low?: { value?: number, unit?: string }
    high?: { value?: number, unit?: string }
  }>
  department?: string
  period?: string
  period_quarter?: string
}

export interface FhirCondition {
  resourceType?: string
  id?: string
  clinicalStatus?: {
    coding?: Array<{ code?: string }>
  }
  code?: {
    coding?: Array<{ system?: string, code?: string, display?: string }>
    text?: string
  }
  subject?: { reference?: string, display?: string }
  onsetDateTime?: string
  recordedDate?: string
}

export interface MedicationChain {
  drugName: string
  drugClass: string
  rxnorm: string
  dosage: string
  route: string
  status: 'active' | 'stopped' | 'completed'
  orders: FhirMedicationRequest[]
  initiationOrder: FhirMedicationRequest
  latestOrder: FhirMedicationRequest
  refillCount: number
  deprescribingRationale?: string
  isFrid: boolean
}

export interface EgfrDataPoint {
  id: string
  date: string
  periodQuarter?: string
  egfr: number
  creatinine?: number
  stage: string
  stageLabel: string
  stageColor: string
}

export function parsePatient(raw: Record<string, unknown>): FhirPatient {
  return raw as FhirPatient
}

export function patientDisplayName(patient: FhirPatient) {
  const name = patient.name?.[0]
  if (!name) return patient.id ?? 'Unknown'
  const given = name.given?.join(' ') ?? ''
  return [given, name.family].filter(Boolean).join(' ') || patient.id || 'Unknown'
}

export function patientMrn(patient: FhirPatient) {
  const official = patient.identifier?.find(i => i.use === 'official')
  return official?.value ?? patient.identifier?.[0]?.value ?? '—'
}

export function patientArchetype(patient: FhirPatient): string | null {
  const ext = patient.extension?.find(e => e.url?.endsWith('geriatric-archetype'))
  return ext?.valueString ?? null
}

export function patientCkdStage(patient: FhirPatient): string | null {
  const ext = patient.extension?.find(e => e.url?.endsWith('ckd-stage'))
  return ext?.valueString ?? null
}

export function getCkdStageInfo(egfr: number): { stage: string, label: string, color: string } {
  if (egfr >= 90) return { stage: 'G1', label: 'Normal / High', color: 'emerald' }
  if (egfr >= 60) return { stage: 'G2', label: 'Mildly Decreased', color: 'green' }
  if (egfr >= 45) return { stage: 'G3a', label: 'Mild to Moderate CKD', color: 'yellow' }
  if (egfr >= 30) return { stage: 'G3b', label: 'Moderate to Severe CKD', color: 'amber' }
  if (egfr >= 15) return { stage: 'G4', label: 'Severe CKD', color: 'orange' }
  return { stage: 'G5', label: 'Kidney Failure (ESRD)', color: 'red' }
}

export function groupMedicationsIntoChains(orders: FhirMedicationRequest[]): MedicationChain[] {
  const byDrug = new Map<string, FhirMedicationRequest[]>()

  for (const order of orders) {
    const rx = order.medicationCodeableConcept?.coding?.[0]?.code ?? order.medicationCodeableConcept?.text ?? 'unknown'
    if (!byDrug.has(rx)) byDrug.set(rx, [])
    byDrug.get(rx)!.push(order)
  }

  const chains: MedicationChain[] = []

  for (const [_, drugOrders] of byDrug) {
    // Sort chronologically
    drugOrders.sort((a, b) => (a.authoredOn ?? '').localeCompare(b.authoredOn ?? ''))

    const initiationOrder = drugOrders[0]
    const latestOrder = drugOrders[drugOrders.length - 1]
    const display = initiationOrder.medicationCodeableConcept?.text ?? initiationOrder.medicationCodeableConcept?.coding?.[0]?.display ?? 'Medication'
    const rxnorm = initiationOrder.medicationCodeableConcept?.coding?.[0]?.code ?? ''
    const dosage = latestOrder.dosageInstruction?.[0]?.text ?? 'Take as directed'
    const route = latestOrder.dosageInstruction?.[0]?.route?.text ?? 'oral'

    // Status: if latest is stopped, whole chain is stopped; if active, active; else completed
    const status = (latestOrder.status === 'stopped' ? 'stopped' : latestOrder.status === 'active' ? 'active' : 'completed') as 'active' | 'stopped' | 'completed'
    const refillCount = Math.max(0, drugOrders.length - 1)
    const deprescribingRationale = latestOrder.statusReason?.text

    // FRID detection
    const lower = display.toLowerCase()
    const isFrid = lower.includes('zolpidem') || lower.includes('diphenhydramine') || lower.includes('gabapentin')

    // Drug class inference
    let drugClass = 'Therapeutic Agent'
    if (lower.includes('lisinopril')) drugClass = 'ACE Inhibitor'
    else if (lower.includes('losartan')) drugClass = 'Angiotensin II Receptor Blocker'
    else if (lower.includes('amlodipine')) drugClass = 'Calcium Channel Blocker'
    else if (lower.includes('atorvastatin') || lower.includes('simvastatin')) drugClass = 'HMG-CoA Reductase Inhibitor'
    else if (lower.includes('metformin')) drugClass = 'Biguanide (Antidiabetic)'
    else if (lower.includes('glipizide')) drugClass = 'Sulfonylurea'
    else if (lower.includes('insulin')) drugClass = 'Long-acting Insulin'
    else if (lower.includes('apixaban')) drugClass = 'DOAC Anticoagulant'
    else if (lower.includes('aspirin') || lower.includes('clopidogrel')) drugClass = 'Antiplatelet'
    else if (lower.includes('furosemide')) drugClass = 'Loop Diuretic'
    else if (lower.includes('hydrochlorothiazide')) drugClass = 'Thiazide Diuretic'
    else if (lower.includes('donepezil')) drugClass = 'Cholinesterase Inhibitor'
    else if (lower.includes('memantine')) drugClass = 'NMDA Receptor Antagonist'
    else if (lower.includes('zolpidem')) drugClass = 'Sedative Hypnotic (FRID)'
    else if (lower.includes('diphenhydramine')) drugClass = 'Antihistamine / Anticholinergic (FRID)'
    else if (lower.includes('gabapentin')) drugClass = 'GABA Analog (FRID)'
    else if (lower.includes('sevelamer')) drugClass = 'Phosphate Binder'
    else if (lower.includes('omeprazole') || lower.includes('pantoprazole')) drugClass = 'Proton Pump Inhibitor'

    chains.push({
      drugName: display,
      drugClass,
      rxnorm,
      dosage,
      route,
      status,
      orders: drugOrders,
      initiationOrder,
      latestOrder,
      refillCount,
      deprescribingRationale,
      isFrid
    })
  }

  // Sort: active first, then stopped, then completed
  return chains.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (b.status === 'active' && a.status !== 'active') return 1
    if (a.status === 'stopped' && b.status !== 'stopped') return -1
    if (b.status === 'stopped' && a.status !== 'stopped') return 1
    return a.drugName.localeCompare(b.drugName)
  })
}

export function extractEgfrSeries(observations: FhirObservation[]): EgfrDataPoint[] {
  // 1. Find all eGFR observations
  const egfrObs = observations.filter(o => {
    const code = o.code?.coding?.[0]?.code
    const text = (o.code?.text ?? o.code?.coding?.[0]?.display ?? '').toLowerCase()
    return code === '98979-8' || text.includes('gfr') || text.includes('glomerular')
  })

  // 2. Map creatinine observations by date (YYYY-MM-DD)
  const creatByDate = new Map<string, number>()
  for (const o of observations) {
    const code = o.code?.coding?.[0]?.code
    const text = (o.code?.text ?? o.code?.coding?.[0]?.display ?? '').toLowerCase()
    if (code === '2160-0' || text.includes('creatinine')) {
      const dateKey = (o.effectiveDateTime ?? '').slice(0, 10)
      if (dateKey && o.valueQuantity?.value !== undefined) {
        creatByDate.set(dateKey, o.valueQuantity.value)
      }
    }
  }

  // 3. Build data points sorted chronologically
  egfrObs.sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? ''))

  return egfrObs.map(o => {
    const val = o.valueQuantity?.value ?? 60
    const stageInfo = getCkdStageInfo(val)
    const dateKey = (o.effectiveDateTime ?? '').slice(0, 10)
    return {
      id: o.id ?? `egfr_${dateKey}`,
      date: dateKey || 'Unknown Date',
      periodQuarter: o.period_quarter ?? o.period,
      egfr: Number(val.toFixed(1)),
      creatinine: creatByDate.get(dateKey),
      stage: stageInfo.stage,
      stageLabel: stageInfo.label,
      stageColor: stageInfo.color
    }
  })
}
