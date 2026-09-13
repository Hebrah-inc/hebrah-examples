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
  try {
    const res = await hebrahFetch('/v1/sandbox/resources/Patient')
    const data = (await res.json()) as { ids?: string[] }
    if (Array.isArray(data.ids) && data.ids.length > 0) {
      return { patients: data.ids.map(id => ({ id })) }
    }
  } catch {
    // Fallback to /v1/patients
  }
  const res = await hebrahFetch('/v1/patients')
  return res.json() as Promise<PatientListResponse>
}

export async function fetchPatient(patientId: string) {
  const res = await hebrahFetch(`/v1/patients/${encodeURIComponent(patientId)}`)
  return res.json() as Promise<Record<string, unknown>>
}

export async function fetchPatientMedications(patientId: string): Promise<Record<string, unknown>[]> {
  try {
    const listRes = await hebrahFetch(`/v1/sandbox/resources/MedicationRequest?patient_id=${encodeURIComponent(patientId)}`)
    const data = (await listRes.json()) as { ids?: string[] }
    const ids = data.ids || []
    if (ids.length === 0) return []
    const items = await Promise.all(
      ids.slice(0, 40).map(async (id) => {
        try {
          const res = await hebrahFetch(
            `/v1/sandbox/resources/MedicationRequest/${encodeURIComponent(id)}?patient_id=${encodeURIComponent(patientId)}`
          )
          return await res.json()
        } catch {
          return null
        }
      })
    )
    return items.filter(Boolean) as Record<string, unknown>[]
  } catch {
    return []
  }
}

export async function fetchPatientObservations(patientId: string): Promise<Record<string, unknown>[]> {
  try {
    const listRes = await hebrahFetch(`/v1/sandbox/resources/Observation?patient_id=${encodeURIComponent(patientId)}`)
    const data = (await listRes.json()) as { ids?: string[] }
    const ids = data.ids || []
    if (ids.length === 0) return []
    const items = await Promise.all(
      ids.slice(0, 50).map(async (id) => {
        try {
          const res = await hebrahFetch(
            `/v1/sandbox/resources/Observation/${encodeURIComponent(id)}?patient_id=${encodeURIComponent(patientId)}`
          )
          return await res.json()
        } catch {
          return null
        }
      })
    )
    return items.filter(Boolean) as Record<string, unknown>[]
  } catch {
    return []
  }
}

export async function fetchPatientConditions(patientId: string): Promise<Record<string, unknown>[]> {
  try {
    const listRes = await hebrahFetch(`/v1/sandbox/resources/Condition?patient_id=${encodeURIComponent(patientId)}`)
    const data = (await listRes.json()) as { ids?: string[] }
    const ids = data.ids || []
    if (ids.length === 0) return []
    const items = await Promise.all(
      ids.slice(0, 20).map(async (id) => {
        try {
          const res = await hebrahFetch(
            `/v1/sandbox/resources/Condition/${encodeURIComponent(id)}?patient_id=${encodeURIComponent(patientId)}`
          )
          return await res.json()
        } catch {
          return null
        }
      })
    )
    return items.filter(Boolean) as Record<string, unknown>[]
  } catch {
    return []
  }
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
