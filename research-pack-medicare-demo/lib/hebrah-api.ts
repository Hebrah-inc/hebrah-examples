import { HebrahApiError, HebrahClient, safePathSegment } from '@hebrah/sdk'
import { getConnectionId, getHebrahApiBaseUrl, getHebrahApiKey, getHebrahEnvironmentId, RESEARCH_PACK_ID } from './env'

export { HebrahApiError }

function client() {
  return new HebrahClient({
    apiKey: getHebrahApiKey(),
    baseUrl: getHebrahApiBaseUrl(),
    defaultConnectionId: getConnectionId() || undefined,
    environmentId: getHebrahEnvironmentId() || undefined
  })
}

async function hebrahFetch(path: string, init?: RequestInit) {
  const base = getHebrahApiBaseUrl().replace(/\/$/, '')
  const apiKey = getHebrahApiKey()
  const connectionId = getConnectionId()
  const environmentId = getHebrahEnvironmentId()
  const url = new URL(`${base}${path}`)
  if (connectionId && !url.searchParams.has('connection_id')) {
    url.searchParams.set('connection_id', connectionId)
  }
  if (environmentId && !url.searchParams.has('environment_id')) {
    url.searchParams.set('environment_id', environmentId)
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

export async function listResearchPacks() {
  const res = await hebrahFetch('/v1/sandbox/research-packs')
  return res.json()
}

export async function applyResearchPack(packId = RESEARCH_PACK_ID) {
  const res = await hebrahFetch(`/v1/sandbox/research-packs/${safePathSegment(packId, 'packId')}/apply`, {
    method: 'POST'
  })
  return res.json()
}

export async function compareResearchPack(packId = RESEARCH_PACK_ID) {
  const res = await hebrahFetch(`/v1/sandbox/research-packs/${safePathSegment(packId, 'packId')}/compare`)
  return res.json()
}

export async function getResearchPackKpis(packId = RESEARCH_PACK_ID) {
  const res = await hebrahFetch(`/v1/sandbox/research-packs/${safePathSegment(packId, 'packId')}/kpis`)
  return res.json()
}

export async function runScenario(scenarioId: string, patientId: string) {
  const connectionId = getConnectionId()
  return client().sandbox.runScenario(scenarioId, {
    patientId,
    ...(connectionId ? { connectionId } : {})
  })
}

export async function fetchCatalog() {
  return client().sandbox.catalog() as Promise<{ sample_patient_ids?: string[] }>
}

