export interface QueueEvent {
  id: string
  receivedAt: string
  event: string
  orgId: string
  patientId?: string
  payload: Record<string, unknown>
}

const queue: QueueEvent[] = []

function extractPatientId(payload: Record<string, unknown>) {
  const resource = payload.resource as Record<string, unknown> | undefined
  if (!resource) return undefined
  if (typeof resource.id === 'string' && resource.resourceType === 'Patient') {
    return resource.id
  }
  const patientId = payload.patient_id
  return typeof patientId === 'string' ? patientId : undefined
}

export function addQueueEvent(event: Omit<QueueEvent, 'id' | 'receivedAt' | 'patientId'>) {
  const stored: QueueEvent = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    patientId: extractPatientId(event.payload),
    ...event
  }
  queue.unshift(stored)
  if (queue.length > 100) {
    queue.length = 100
  }
  return stored
}

export function listQueueEvents() {
  return queue
}
