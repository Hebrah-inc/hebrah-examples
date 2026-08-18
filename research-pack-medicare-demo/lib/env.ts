export function getHebrahApiBaseUrl() {
  return process.env.HEBRAH_API_BASE_URL ?? 'http://localhost:8000'
}

export function getHebrahApiKey() {
  const key = process.env.HEBRAH_SANDBOX_API_KEY
  if (!key) throw new Error('HEBRAH_SANDBOX_API_KEY is not configured')
  return key
}

export function getConnectionId() {
  return process.env.HEBRAH_CONNECTION_ID ?? ''
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3012'
}

export const RESEARCH_PACK_ID = 'medicare_utilization_v1'
