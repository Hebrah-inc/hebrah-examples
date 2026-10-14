import { NextResponse } from 'next/server'

const ALLOWED_WRITEBACK_ACTIONS = new Set(['chart-note', 'prior-auth', 'medication-request'])
const SAFE_PATIENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export async function POST(request: Request) {
  const url = process.env.SIDECAR_WRITEBACK_URL
  if (!url) {
    return NextResponse.json(
      { message: 'SIDECAR_WRITEBACK_URL is not configured' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json() as { action?: string, patientId?: string }
    const action = body.action ?? 'chart-note'
    if (!ALLOWED_WRITEBACK_ACTIONS.has(action)) {
      return NextResponse.json(
        { message: `Invalid writeback action: ${action}` },
        { status: 400 }
      )
    }

    const patientId = body.patientId ?? 'pat_00000000_01'
    if (!SAFE_PATIENT_ID_PATTERN.test(patientId)) {
      return NextResponse.json(
        { message: 'Invalid patientId format' },
        { status: 400 }
      )
    }

    const endpoint = `${url.replace(/\/$/, '')}/v1/writeback/${encodeURIComponent(action)}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId })
    })
    const payload = await res.json().catch(() => ({}))
    return NextResponse.json(payload, { status: res.status })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Write-back failed' },
      { status: 500 }
    )
  }
}
