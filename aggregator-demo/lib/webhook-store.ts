export interface AggregatorEvent {
  id: string
  receivedAt: string
  event: string
  orgId: string
  payload: Record<string, unknown>
}

const inbox: AggregatorEvent[] = []

export function addAggregatorEvent(event: Omit<AggregatorEvent, 'id' | 'receivedAt'>) {
  const stored: AggregatorEvent = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...event
  }
  inbox.unshift(stored)
  if (inbox.length > 100) {
    inbox.length = 100
  }
  return stored
}

export function listAggregatorEvents() {
  return inbox
}
