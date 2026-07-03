import { NextResponse } from 'next/server'
import { getDefaultPatientId } from '@/lib/env'
import { mcpRunScenario, mcpTriggerWebhook } from '@/lib/mcp-client'

const PA_EVENTS = new Set([
  'prior_auth.submitted',
  'prior_auth.pended',
  'prior_auth.approved',
  'prior_auth.denied'
])

const SCENARIOS = new Set([
  'prior_auth_happy_path',
  'prior_auth_pend_then_approve',
  'prior_auth_denial'
])

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    event?: string
    patientId?: string
    scenarioId?: string
  }

  const patientId = body.patientId ?? getDefaultPatientId()

  try {
    if (body.scenarioId) {
      if (!SCENARIOS.has(body.scenarioId)) {
        return NextResponse.json({ message: 'Unknown scenarioId' }, { status: 400 })
      }
      const result = await mcpRunScenario(body.scenarioId, patientId)
      return NextResponse.json({ ok: true, result })
    }

    const event = body.event ?? 'prior_auth.submitted'
    if (!PA_EVENTS.has(event)) {
      return NextResponse.json(
        { message: 'event must be a prior_auth.* event or provide scenarioId' },
        { status: 400 }
      )
    }

    const result = await mcpTriggerWebhook(event, patientId)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
