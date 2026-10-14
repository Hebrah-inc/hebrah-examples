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

/**
 * Resolve the SMART issuer URL safely to prevent SSRF / bearer token exfiltration.
 * Rejects any client-supplied `iss` whose origin does not match `HEBRAH_API_BASE_URL`.
 */
export function resolveSafeIssuer(clientIss?: string): string {
  const configured = getHebrahApiBaseUrl().replace(/\/$/, '')
  if (!clientIss) return configured
  try {
    const expectedOrigin = new URL(configured).origin
    const candidate = new URL(clientIss)
    if (candidate.origin !== expectedOrigin) {
      throw new Error(`Untrusted SMART issuer origin: ${candidate.origin}`)
    }
    return configured
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Untrusted SMART issuer')) {
      throw err
    }
    throw new Error('Invalid SMART issuer URL')
  }
}
