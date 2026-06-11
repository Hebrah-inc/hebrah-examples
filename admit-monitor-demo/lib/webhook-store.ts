export interface StoredWebhookEvent {
  id: string
  receivedAt: string
  event: string
  connectionId: string
  environment: string
  orgId: string
  patientId?: string
  patientName?: string
  resourceType?: string
  payload: Record<string, unknown>
}

export interface CensusPatient {
  patientId: string
  patientName?: string
  admittedAt: string
}

export interface AdtFeedEntry {
  id: string
  at: string
  event: 'patient.admitted' | 'patient.discharged'
  patientId: string
  patientName?: string
}

const MAX_EVENTS = 100
const events: StoredWebhookEvent[] = []
const census = new Map<string, CensusPatient>()
const adtFeed: AdtFeedEntry[] = []

function extractPatientId(payload: Record<string, unknown>): string | null {
  if (typeof payload.patient_id === 'string') return payload.patient_id
  const resource = payload.resource as Record<string, unknown> | undefined
  if (!resource) return null
  if (resource.resourceType === 'Patient' && typeof resource.id === 'string') {
    return resource.id
  }
  const subject = resource.subject as { reference?: string } | undefined
  if (subject?.reference?.startsWith('Patient/')) {
    return subject.reference.replace('Patient/', '')
  }
  const patient = resource.patient as { reference?: string } | undefined
  if (patient?.reference?.startsWith('Patient/')) {
    return patient.reference.replace('Patient/', '')
  }
  return null
}

function extractPatientName(payload: Record<string, unknown>): string | undefined {
  const resource = payload.resource as Record<string, unknown> | undefined
  if (!resource || resource.resourceType !== 'Patient') return undefined
  const nameArr = resource.name as Array<{ given?: string[], family?: string }> | undefined
  const first = nameArr?.[0]
  if (!first) return undefined
  const given = first.given?.join(' ') ?? ''
  const family = first.family ?? ''
  const full = `${given} ${family}`.trim()
  return full || undefined
}

export function applyAdtEvent(event: string, payload: Record<string, unknown>, receivedAt: string) {
  const patientId = extractPatientId(payload)
  if (!patientId) return

  const patientName = extractPatientName(payload)

  if (event === 'patient.admitted') {
    census.set(patientId, {
      patientId,
      patientName,
      admittedAt: receivedAt
    })
    adtFeed.unshift({
      id: crypto.randomUUID(),
      at: receivedAt,
      event: 'patient.admitted',
      patientId,
      patientName
    })
  } else if (event === 'patient.discharged') {
    const existing = census.get(patientId)
    census.delete(patientId)
    adtFeed.unshift({
      id: crypto.randomUUID(),
      at: receivedAt,
      event: 'patient.discharged',
      patientId,
      patientName: patientName ?? existing?.patientName
    })
  }

  if (adtFeed.length > MAX_EVENTS) {
    adtFeed.length = MAX_EVENTS
  }
}

export function addWebhookEvent(event: Omit<StoredWebhookEvent, 'id' | 'receivedAt'>) {
  const stored: StoredWebhookEvent = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...event
  }
  events.unshift(stored)
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS
  }

  if (event.event === 'patient.admitted' || event.event === 'patient.discharged') {
    applyAdtEvent(event.event, event.payload, stored.receivedAt)
  }

  return stored
}

export function listWebhookEvents(limit = 50) {
  return events.slice(0, limit)
}

export function getCensus(): CensusPatient[] {
  return [...census.values()].sort(
    (a, b) => new Date(b.admittedAt).getTime() - new Date(a.admittedAt).getTime()
  )
}

export function getAdtFeed(limit = 50): AdtFeedEntry[] {
  return adtFeed.slice(0, limit)
}
