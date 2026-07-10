import { getConnectionId, getHebrahApiBaseUrl, getHebrahApiKey } from './env'

export class HebrahApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message)
    this.name = 'HebrahApiError'
  }
}

async function hebrahFetch(path: string, init?: RequestInit) {
  const base = getHebrahApiBaseUrl().replace(/\/$/, '')
  const apiKey = getHebrahApiKey()
  const connectionId = getConnectionId()
  const url = new URL(`${base}${path}`)
  if (connectionId && !url.searchParams.has('connection_id')) {
    url.searchParams.set('connection_id', connectionId)
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    })
  } catch {
    throw new HebrahApiError(`Control plane unreachable at ${base}`, 503)
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new HebrahApiError(`Request failed (${response.status})`, response.status, detail)
  }
  return response
}

export async function fetchResourceList(resourceType: string) {
  const res = await hebrahFetch(`/v1/sandbox/resources/${resourceType}`)
  return res.json() as Promise<{ resource_type: string; ids: string[] }>
}

export async function fetchResource(resourceType: string, resourceId: string, patientId?: string) {
  const path = `/v1/sandbox/resources/${resourceType}/${encodeURIComponent(resourceId)}`
  const url = new URL(`${getHebrahApiBaseUrl().replace(/\/$/, '')}${path}`)
  if (getConnectionId()) url.searchParams.set('connection_id', getConnectionId())
  if (patientId) url.searchParams.set('patient_id', patientId)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getHebrahApiKey()}` }
  })
  if (!res.ok) throw new HebrahApiError('Resource fetch failed', res.status, await res.text())
  return res.json() as Promise<Record<string, unknown>>
}

export async function fetchSyntheticProfile() {
  const res = await hebrahFetch('/v1/sandbox/synthetic-ehr/profile')
  return res.json() as Promise<Record<string, unknown>>
}

export async function runScenario(scenarioId: string, patientId: string) {
  const connectionId = getConnectionId()
  const res = await hebrahFetch(`/v1/sandbox/scenarios/${scenarioId}/run`, {
    method: 'POST',
    body: JSON.stringify({
      patient_id: patientId,
      ...(connectionId ? { connection_id: connectionId } : {})
    })
  })
  return res.json()
}

export async function injectHl7(templateId: string, patientId: string) {
  const connectionId = getConnectionId()
  const res = await hebrahFetch('/v1/sandbox/hl7/inject', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      patient_id: patientId,
      deliver: true,
      ...(connectionId ? { connection_id: connectionId } : {})
    })
  })
  return res.json()
}

export type ChartNoteType =
  | 'progress'
  | 'soap'
  | 'admission'
  | 'discharge'
  | 'operative'
  | 'nursing'

export type ChartNoteWritebackResult = {
  status: string
  composition_id: string
  correlation_id?: string | null
  webhook_event?: string | null
  webhook_delivered?: boolean
}

export async function writeChartNote(
  patientId: string,
  noteText: string,
  noteType: ChartNoteType = 'progress'
) {
  const connectionId = getConnectionId()
  const res = await hebrahFetch('/v1/writeback/chart-note', {
    method: 'POST',
    body: JSON.stringify({
      patient_id: patientId,
      note_text: noteText,
      note_type: noteType,
      ...(connectionId ? { connection_id: connectionId } : {})
    })
  })
  return res.json() as Promise<ChartNoteWritebackResult>
}

export async function fetchSandboxDomains() {
  const res = await hebrahFetch('/v1/sandbox/domains')
  return res.json() as Promise<Array<{
    id: string
    resource_types?: string[]
    scenarios?: Array<{ id: string, name: string }>
  }>>
}

export async function triggerMockEvent(event: string, patientId: string) {
  const connectionId = getConnectionId()
  const res = await hebrahFetch('/v1/webhooks/trigger-mock-event', {
    method: 'POST',
    body: JSON.stringify({
      event,
      patient_id: patientId,
      ...(connectionId ? { connection_id: connectionId } : {})
    })
  })
  return res.json()
}
