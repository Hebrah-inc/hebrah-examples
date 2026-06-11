import { NextResponse } from 'next/server'
import { mcpTriggerWebhook } from '@/lib/mcp-client'

const ADT_EVENTS = new Set(['patient.admitted', 'patient.discharged'])

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    event?: string
    patientId?: string
  }

  const event = body.event ?? 'patient.admitted'
  if (!ADT_EVENTS.has(event)) {
    return NextResponse.json(
      { message: 'event must be patient.admitted or patient.discharged' },
      { status: 400 }
    )
  }

  const patientId = body.patientId ?? 'pat_00000000_01'

  try {
    const result = await mcpTriggerWebhook(event, patientId)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
