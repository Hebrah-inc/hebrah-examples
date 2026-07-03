export function getHebrahApiBaseUrl() {
  return process.env.HEBRAH_API_BASE_URL ?? 'http://localhost:8000'
}

export function getSmartClientId() {
  const clientId = process.env.SMART_CLIENT_ID
  if (!clientId) {
    throw new Error('SMART_CLIENT_ID is not configured')
  }
  return clientId
}

export function getSmartRedirectUri() {
  return process.env.SMART_REDIRECT_URI ?? 'http://localhost:3005'
}

export function getWebhookSecret() {
  const secret = process.env.HEBRAH_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('HEBRAH_WEBHOOK_SECRET is not configured')
  }
  return secret
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3005'
}
