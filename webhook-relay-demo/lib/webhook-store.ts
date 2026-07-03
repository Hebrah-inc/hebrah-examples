export interface StoredWebhookEvent {
  id: string
  receivedAt: string
  event: string
  connectionId: string
  environment: string
  orgId: string
  deliveryId?: string
  statusCode: number
  payload: Record<string, unknown>
}

const MAX_EVENTS = 100
const events: StoredWebhookEvent[] = []
let acceptedCount = 0
let rejectedCount = 0

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
  if (event.statusCode >= 200 && event.statusCode < 300) {
    acceptedCount += 1
  } else {
    rejectedCount += 1
  }
  return stored
}

export function listWebhookEvents(limit = 50) {
  return events.slice(0, limit)
}

export function getRelayStats() {
  return { acceptedCount, rejectedCount, total: events.length }
}

export function clearRelayStats() {
  events.length = 0
  acceptedCount = 0
  rejectedCount = 0
}
