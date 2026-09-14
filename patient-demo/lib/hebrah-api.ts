// patient-demo — Hebrah control-plane access via the official SDK.
//
// Demo Act 3 exercises the real `@hebrah/sdk` surface end-to-end. This
// module keeps the same exported function signatures the demo components
// already import, so the migration from hand-rolled fetch is invisible
// to the UI: every call now goes through `HebrahClient` (typed client,
// timeouts, error contract) instead of bespoke fetch plumbing.

import {
  HebrahApiError,
  HebrahClient,
  type PatientListResponse,
  type SandboxCatalog,
  type TriggerMockEventResponse
} from '@hebrah/sdk'

import { getHebrahApiBaseUrl, getHebrahApiKey, getHebrahConnectionId } from './env'

export { HebrahApiError }

export type { SandboxCatalog, PatientListResponse, TriggerMockEventResponse }

let _client: HebrahClient | undefined

/** Singleton SDK client configured from the demo's env contract. */
export function hebrahClient(): HebrahClient {
  if (!_client) {
    _client = new HebrahClient({
      apiKey: getHebrahApiKey(),
      baseUrl: getHebrahApiBaseUrl(),
      defaultConnectionId: getHebrahConnectionId()
    })
  }
  return _client
}

export async function fetchSandboxCatalog(): Promise<SandboxCatalog> {
  return hebrahClient().sandbox.catalog()
}

export async function fetchPatientList(): Promise<PatientListResponse> {
  const client = hebrahClient()
  try {
    const res = await client.sandbox.listSyntheticResources('Patient')
    if (Array.isArray(res.ids) && res.ids.length > 0) {
      return { patients: res.ids.map(id => ({ id })) }
    }
  } catch {
    // Fall back to the /v1/patients surface via the SDK.
  }
  return client.patients.list()
}

export async function fetchPatient(patientId: string): Promise<Record<string, unknown>> {
  return hebrahClient().patients.get(patientId)
}

/**
 * List a sandbox resource type for a patient, then hydrate each id with a
 * patient-scoped detail read — the FHIR R4 MedicationRequest /
 * Observation / Condition charts the demo renders.
 */
async function fetchPatientResources(
  resourceType: 'MedicationRequest' | 'Observation' | 'Condition',
  patientId: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const client = hebrahClient()
  try {
    const listRes = await client.sandbox.listSyntheticResources(resourceType)
    const ids = Array.isArray(listRes.ids) ? listRes.ids : []
    if (ids.length === 0) return []
    const items = await Promise.all(
      ids.slice(0, limit).map(async (id) => {
        try {
          return await client.sandbox.resource(resourceType, id, patientId)
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

export function fetchPatientMedications(patientId: string): Promise<Record<string, unknown>[]> {
  return fetchPatientResources('MedicationRequest', patientId, 40)
}

export function fetchPatientObservations(patientId: string): Promise<Record<string, unknown>[]> {
  return fetchPatientResources('Observation', patientId, 50)
}

export function fetchPatientConditions(patientId: string): Promise<Record<string, unknown>[]> {
  return fetchPatientResources('Condition', patientId, 20)
}

export async function triggerMockEvent(
  event: string,
  patientId?: string
): Promise<TriggerMockEventResponse> {
  return hebrahClient().webhooks.triggerMockEvent({
    event,
    ...(patientId ? { patientId } : {})
  })
}