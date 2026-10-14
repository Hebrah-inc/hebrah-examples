import {
  HebrahApiError,
  HebrahClient
} from '@hebrah/sdk'
import { getConnectionId, getHebrahApiBaseUrl, getHebrahApiKey } from './env'

export { HebrahApiError }

export type ChartNoteType =
  | 'progress'
  | 'soap'
  | 'admission'
  | 'discharge'
  | 'operative'
  | 'nursing'
  | 'consult'
  | 'procedure'

export interface ChartNoteWritebackResult {
  composition_id: string
  document_reference: Record<string, unknown>
  Composition: Record<string, unknown>
  provenance: Record<string, unknown>
  webhook_delivery: Record<string, unknown>
}

let _client: HebrahClient | undefined

export function hebrahClient(): HebrahClient {
  if (!_client) {
    _client = new HebrahClient({
      apiKey: getHebrahApiKey(),
      baseUrl: getHebrahApiBaseUrl(),
      defaultConnectionId: getConnectionId() || undefined,
      environmentId: process.env.HEBRAH_ENVIRONMENT_ID || undefined
    })
  }
  return _client
}

export async function fetchResourceList(resourceType: string) {
  return hebrahClient().sandbox.listSyntheticResources(resourceType)
}

export async function fetchResource(resourceType: string, resourceId: string, patientId?: string) {
  return hebrahClient().sandbox.resource(resourceType, resourceId, patientId)
}

export async function fetchSyntheticProfile() {
  return hebrahClient().sandbox.getSyntheticEhrProfile() as unknown as Promise<Record<string, unknown>>
}

export async function runScenario(scenarioId: string, patientId: string) {
  return hebrahClient().sandbox.runScenario(scenarioId, { patientId })
}

export async function injectHl7(templateId: string, patientId: string) {
  return hebrahClient().sandbox.injectHl7({
    templateId,
    patientId,
    deliver: true
  })
}

export async function writeChartNote(
  patientId: string,
  noteText: string,
  noteType: ChartNoteType = 'progress'
): Promise<ChartNoteWritebackResult> {
  const base = getHebrahApiBaseUrl().replace(/\/$/, '')
  const apiKey = getHebrahApiKey()
  const connectionId = getConnectionId()
  const res = await fetch(`${base}/v1/writeback/chart-note`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patient_id: patientId,
      note_text: noteText,
      note_type: noteType,
      ...(connectionId ? { connection_id: connectionId } : {})
    })
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new HebrahApiError(`Chart note writeback failed (${res.status})`, res.status, detail)
  }
  return res.json() as Promise<ChartNoteWritebackResult>
}

export async function fetchSandboxDomains() {
  return hebrahClient().sandbox.domains() as unknown as Promise<Array<{
    id: string
    resource_types?: string[]
    scenarios?: Array<{ id: string, name: string }>
  }>>
}

export async function triggerMockEvent(event: string, patientId: string) {
  return hebrahClient().webhooks.triggerMockEvent({
    event,
    patientId
  })
}
