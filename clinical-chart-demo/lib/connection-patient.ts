import { getConnectionId } from './env'

export function connectionShortId(connectionId: string): string {
  return connectionId.replace(/-/g, '_').slice(0, 32)
}

export function connectionPatientId(connectionId: string, index = 1): string {
  return `pat_${connectionShortId(connectionId)}_${String(index).padStart(2, '0')}`
}

export function defaultPatientId(): string {
  const connectionId = getConnectionId()
  if (!connectionId) return 'pat_01JM'
  return connectionPatientId(connectionId)
}
