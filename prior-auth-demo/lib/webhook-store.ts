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
  taskId?: string
  taskStatus?: string
  payerId?: string
  payload: Record<string, unknown>
}

export interface PaQueueItem {
  taskId: string
  patientId: string
  patientName?: string
  status: 'submitted' | 'pended' | 'approved' | 'denied'
  payerId?: string
  updatedAt: string
}

export interface PaActivityEntry {
  id: string
  at: string
  event: string
  patientId: string
  taskId?: string
  status?: string
}

const MAX_EVENTS = 100
const events: StoredWebhookEvent[] = []
const paQueue = new Map<string, PaQueueItem>()
const paActivity: PaActivityEntry[] = []

function extractPatientId(payload: Record<string, unknown>): string | null {
  const resource = payload.resource as Record<string, unknown> | undefined
  if (!resource) return null
  const forRef = resource.for as { reference?: string } | undefined
  if (forRef?.reference?.startsWith('Patient/')) {
    return forRef.reference.replace('Patient/', '')
  }
  const subject = resource.subject as { reference?: string } | undefined
  if (subject?.reference?.startsWith('Patient/')) {
    return subject.reference.replace('Patient/', '')
  }
  return null
}

function extractTaskMeta(payload: Record<string, unknown>) {
  const resource = payload.resource as Record<string, unknown> | undefined
  if (!resource || resource.resourceType !== 'Task') {
    return { taskId: undefined, taskStatus: undefined, payerId: undefined }
  }
  const extensions = resource.extension as Array<{ url?: string, valueString?: string }> | undefined
  const payerExt = extensions?.find(e => e.url === 'https://hebrah.com/sandbox/payer-id')
  return {
    taskId: typeof resource.id === 'string' ? resource.id : undefined,
    taskStatus: typeof resource.status === 'string' ? resource.status : undefined,
    payerId: payerExt?.valueString
  }
}

function mapPaStatus(event: string): PaQueueItem['status'] | null {
  if (event === 'prior_auth.submitted') return 'submitted'
  if (event === 'prior_auth.pended') return 'pended'
  if (event === 'prior_auth.approved') return 'approved'
  if (event === 'prior_auth.denied') return 'denied'
  return null
}

export function applyPaEvent(event: string, payload: Record<string, unknown>, receivedAt: string) {
  const patientId = extractPatientId(payload)
  const { taskId, taskStatus, payerId } = extractTaskMeta(payload)
  const mapped = mapPaStatus(event)
  if (!patientId || !taskId || !mapped) return

  paQueue.set(taskId, {
    taskId,
    patientId,
    status: mapped,
    payerId,
    updatedAt: receivedAt
  })

  paActivity.unshift({
    id: crypto.randomUUID(),
    at: receivedAt,
    event,
    patientId,
    taskId,
    status: taskStatus ?? mapped
  })

  if (paActivity.length > MAX_EVENTS) {
    paActivity.length = MAX_EVENTS
  }
}

export function addWebhookEvent(event: Omit<StoredWebhookEvent, 'id' | 'receivedAt'>) {
  const { taskId, taskStatus, payerId } = extractTaskMeta(event.payload)
  const stored: StoredWebhookEvent = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    patientId: extractPatientId(event.payload) ?? event.patientId,
    taskId,
    taskStatus,
    payerId,
    ...event
  }
  events.unshift(stored)
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS
  }

  if (event.event.startsWith('prior_auth.')) {
    applyPaEvent(event.event, event.payload, stored.receivedAt)
  }

  return stored
}

export function listWebhookEvents(limit = 50) {
  return events.slice(0, limit)
}

export function getPaQueue(): PaQueueItem[] {
  return [...paQueue.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getPaActivity(limit = 50): PaActivityEntry[] {
  return paActivity.slice(0, limit)
}

export function getPaForPatient(patientId: string): PaQueueItem[] {
  return getPaQueue().filter(item => item.patientId === patientId)
}
