export function getHebrahApiBaseUrl() {
  return process.env.HEBRAH_API_BASE_URL ?? process.env.WHILE_API_BASE_URL ?? 'http://localhost:8000'
}

export function getHebrahApiKey() {
  const key =
    process.env.HEBRAH_SANDBOX_API_KEY ||
    process.env.WHILE_SANDBOX_API_KEY ||
    'hb_test_d05c54d3c004bf7f84c050cc44471371'
  return key
}

export function getWebhookSecret() {
  const secret =
    process.env.HEBRAH_WEBHOOK_SECRET ||
    process.env.WHILE_WEBHOOK_SECRET ||
    'hbsec_234dfa1a892b45e997f7faea5c9076ae'
  return secret
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
}

export function getEnvStatus() {
  return {
    apiBaseUrl: Boolean(process.env.HEBRAH_API_BASE_URL),
    apiKey: Boolean(process.env.HEBRAH_SANDBOX_API_KEY),
    webhookSecret: Boolean(process.env.HEBRAH_WEBHOOK_SECRET),
    publicAppUrl: getPublicAppUrl()
  }
}
