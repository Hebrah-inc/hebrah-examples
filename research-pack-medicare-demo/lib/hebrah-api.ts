import { getConnectionId, getHebrahApiBaseUrl, getHebrahApiKey, RESEARCH_PACK_ID } from './env'

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

export async function listResearchPacks() {
  const res = await hebrahFetch('/v1/sandbox/research-packs')
  return res.json()
}

export async function applyResearchPack(packId = RESEARCH_PACK_ID) {
  const res = await hebrahFetch(`/v1/sandbox/research-packs/${encodeURIComponent(packId)}/apply`, {
    method: 'POST'
  })
  return res.json()
}

export async function compareResearchPack(packId = RESEARCH_PACK_ID) {
  const res = await hebrahFetch(`/v1/sandbox/research-packs/${encodeURIComponent(packId)}/compare`)
  return res.json()
}

export async function getResearchPackKpis(packId = RESEARCH_PACK_ID) {
  const res = await hebrahFetch(`/v1/sandbox/research-packs/${encodeURIComponent(packId)}/kpis`)
  return res.json()
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

export async function fetchCatalog() {
  const res = await hebrahFetch('/v1/sandbox/catalog')
  return res.json() as Promise<{ sample_patient_ids?: string[] }>
}
