export function getHebrahApiBaseUrl() {
  return process.env.HEBRAH_API_BASE_URL ?? 'http://localhost:8000'
}

export function getHebrahApiKey() {
  const key = process.env.HEBRAH_SANDBOX_API_KEY
  if (!key) throw new Error('HEBRAH_SANDBOX_API_KEY is not configured')
  return key
}

export function getWebhookSecret() {
  const secret = process.env.HEBRAH_WEBHOOK_SECRET
  if (!secret) throw new Error('HEBRAH_WEBHOOK_SECRET is not configured')
  return secret
}
