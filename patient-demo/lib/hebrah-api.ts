import { getHebrahApiBaseUrl, getHebrahApiKey } from './env'

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

  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    })
  } catch {
    throw new HebrahApiError(
      `Control plane unreachable at ${base}. Is hebrah-api running?`,
      503
    )
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new HebrahApiError(
      `Control plane request failed (${response.status})`,
      response.status,
      detail
    )
  }

  return response
}

export interface SandboxCatalog {
  org_id: string
  org_name: string
  connection_id: string
  environment: string
  sample_patient_ids: string[]
  supported_events: string[]
  example_patient_response: Record<string, unknown>
  example_webhook_envelope: Record<string, unknown>
}

export interface PatientListResponse {
  patients: Array<{ id: string }>
}

export interface TriggerMockEventResponse {
  status: string
  event: string
  patient_id?: string
  connection_id: string
  envelope_preview: Record<string, unknown>
}

export async function fetchSandboxCatalog() {
  const res = await hebrahFetch('/v1/sandbox/catalog')
  return res.json() as Promise<SandboxCatalog>
}

export async function fetchPatientList() {
  const res = await hebrahFetch('/v1/patients')
  return res.json() as Promise<PatientListResponse>
}

export async function fetchPatient(patientId: string) {
  const res = await hebrahFetch(`/v1/patients/${encodeURIComponent(patientId)}`)
  return res.json() as Promise<Record<string, unknown>>
}

export async function triggerMockEvent(event: string, patientId?: string) {
  const res = await hebrahFetch('/v1/webhooks/trigger-mock-event', {
    method: 'POST',
    body: JSON.stringify({
      event,
      ...(patientId ? { patient_id: patientId } : {})
    })
  })
  return res.json() as Promise<TriggerMockEventResponse>
}
