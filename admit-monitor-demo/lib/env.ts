export function getWebhookSecret() {
  const secret = process.env.HEBRAH_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('HEBRAH_WEBHOOK_SECRET is not configured')
  }
  return secret
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'
}

export function getMcpUrl() {
  return process.env.HEBRAH_MCP_URL ?? 'http://localhost:3021/mcp'
}

export function getMcpPat() {
  const pat = process.env.HEBRAH_PAT
  if (!pat?.startsWith('hb_pat_')) {
    throw new Error('HEBRAH_PAT must be set (create via hebrah-app Settings → MCP)')
  }
  return pat
}

export function getConnectionId() {
  const id = process.env.HEBRAH_CONNECTION_ID
  if (!id) {
    throw new Error('HEBRAH_CONNECTION_ID is not configured')
  }
  return id
}

export function getEnvStatus() {
  return {
    webhookSecret: Boolean(process.env.HEBRAH_WEBHOOK_SECRET),
    publicAppUrl: getPublicAppUrl(),
    mcpUrl: Boolean(process.env.HEBRAH_MCP_URL),
    pat: Boolean(process.env.HEBRAH_PAT?.startsWith('hb_pat_')),
    connectionId: Boolean(process.env.HEBRAH_CONNECTION_ID)
  }
}
