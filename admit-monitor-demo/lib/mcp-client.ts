import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { getConnectionId, getMcpPat, getMcpUrl } from './env'

let activeConnectionSet = false

async function withMcpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(getMcpUrl()), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${getMcpPat()}`
      }
    }
  })

  const client = new Client({ name: 'admit-monitor-demo', version: '0.1.0' })
  await client.connect(transport)
  try {
    return await fn(client)
  } finally {
    await client.close()
  }
}

async function ensureActiveConnection(client: Client) {
  if (activeConnectionSet) return
  await client.callTool({
    name: 'set_active_connection',
    arguments: { connectionId: getConnectionId() }
  })
  activeConnectionSet = true
}

export async function mcpGetAccountStatus() {
  return withMcpClient(async (client) => {
    const result = await client.callTool({ name: 'get_account_status', arguments: {} })
    return parseToolResult(result)
  })
}

export async function mcpTriggerWebhook(event: string, patientId: string) {
  return withMcpClient(async (client) => {
    await ensureActiveConnection(client)
    const result = await client.callTool({
      name: 'trigger_test_webhook',
      arguments: {
        event,
        patient_id: patientId,
        connection_id: getConnectionId()
      }
    })
    return parseToolResult(result)
  })
}

function parseToolResult(result: unknown) {
  const r = result as { content?: Array<{ type: string, text?: string }>, isError?: boolean }
  const text = r.content?.find(c => c.type === 'text')?.text ?? ''
  if (r.isError) {
    throw new Error(text || 'MCP tool failed')
  }
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}
