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

export function getConnectionId() {
  return process.env.HEBRAH_CONNECTION_ID ?? ''
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3009'
}

const WEBHOOK_RECEIVER_PATH = '/api/webhooks/hebrah'

export function getWebhookReceiverUrl() {
  return `${getPublicAppUrl().replace(/\/$/, '')}${WEBHOOK_RECEIVER_PATH}`
}

/** URL hebrah-api in Docker can reach on the host (localhost → host.docker.internal). */
export function getDockerWebhookUrl() {
  try {
    const base = new URL(getPublicAppUrl())
    const port = base.port || (base.protocol === 'https:' ? '443' : '80')
    const host = base.hostname === 'localhost' || base.hostname === '127.0.0.1'
      ? 'host.docker.internal'
      : base.hostname
    return `http://${host}:${port}${WEBHOOK_RECEIVER_PATH}`
  } catch {
    return getWebhookReceiverUrl()
  }
}
