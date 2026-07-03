export interface CredentialingEvent {
  id: string
  receivedAt: string
  event: string
  orgId: string
  payload: Record<string, unknown>
}

const inbox: CredentialingEvent[] = []

export function addCredentialingEvent(event: Omit<CredentialingEvent, 'id' | 'receivedAt'>) {
  const stored: CredentialingEvent = {
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

export function listCredentialingEvents() {
  return inbox
}
