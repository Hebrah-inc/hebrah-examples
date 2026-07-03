import { NextResponse } from 'next/server'
import { getHebrahApiBaseUrl, getHebrahApiKey } from '@/lib/env'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    patient_id?: string
    include_consent?: boolean
    include_provenance?: boolean
  }

  if (!body.patient_id) {
    return NextResponse.json({ message: 'patient_id is required' }, { status: 400 })
  }

  const base = getHebrahApiBaseUrl().replace(/\/$/, '')
  const response = await fetch(`${base}/v1/sandbox/aggregator/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getHebrahApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patient_id: body.patient_id,
      include_consent: body.include_consent ?? true,
      include_provenance: body.include_provenance ?? true
    })
  })

  const text = await response.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {}

  if (!response.ok) {
    return NextResponse.json({ message: 'Aggregator query failed', detail: parsed }, { status: response.status })
  }
  return NextResponse.json(parsed)
}
