import { fetchSyntheticProfile } from './hebrah-api'

export type SyntheticEhrProfileLike = {
  base_url?: string
  host_base_url?: string
  fhir_base_path?: string
}

/** Prefer host-reachable VM FHIR URL over guest WireGuard address (10.8.0.2). */
export function resolveVmFhirBaseUrl(
  profile: SyntheticEhrProfileLike,
  override?: string | null
): string | null {
  const explicit = override?.trim() || process.env.HEBRAH_VM_FHIR_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const hostBase = profile.host_base_url?.trim()
  if (hostBase) return hostBase.replace(/\/$/, '')

  const guestBase = profile.base_url?.trim()
  return guestBase ? guestBase.replace(/\/$/, '') : null
}

export async function loadVmFhirBaseUrl(): Promise<string> {
  const profile = await fetchSyntheticProfile() as SyntheticEhrProfileLike
  const baseUrl = resolveVmFhirBaseUrl(profile)
  if (!baseUrl) {
    throw new Error('Synthetic EHR profile missing VM FHIR base URL')
  }
  return baseUrl
}

export async function fetchVmFhir(path: string, init?: RequestInit) {
  const baseUrl = await loadVmFhirBaseUrl()
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { cache: 'no-store', ...init })
  return { res, url }
}
