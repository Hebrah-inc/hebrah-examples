import { NextResponse } from 'next/server'

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
    const endpoint = `${url.replace(/\/$/, '')}/v1/writeback/${action}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: body.patientId ?? 'pat_00000000_01' })
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
