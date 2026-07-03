export interface WebhookEvent {
  id: string
  receivedAt: string
  event: string
  orgId: string
  payload: Record<string, unknown>
}

const events: WebhookEvent[] = []

export function addWebhookEvent(event: Omit<WebhookEvent, 'id' | 'receivedAt'>) {
  const stored: WebhookEvent = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...event
  }
  events.unshift(stored)
  if (events.length > 50) {
    events.length = 50
  }
  return stored
}
