import { mcpTriggerWebhook } from '../lib/mcp-client'

const action = process.argv[2]
const patientId = process.argv[3] ?? 'pat_00000000_01'

if (action !== 'admit' && action !== 'discharge') {
  console.error('Usage: pnpm mcp:admit | pnpm mcp:discharge [patientId]')
  process.exit(1)
}

const event = action === 'admit' ? 'patient.admitted' : 'patient.discharged'

try {
  const result = await mcpTriggerWebhook(event, patientId)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
