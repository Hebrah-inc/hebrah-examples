export interface StoredWebhookEvent {
  id: string
  receivedAt: string
  event: string
  connectionId: string
  environment: string
  orgId: string
  resourceType?: string
  payload: Record<string, unknown>
}

const MAX_EVENTS = 100
const events: StoredWebhookEvent[] = []

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
  return stored
}

export function listWebhookEvents(limit = 50) {
  return events.slice(0, limit)
}
