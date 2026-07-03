import { NextResponse } from 'next/server'
import { getDefaultPatientId, getHebrahApiBaseUrl, getHebrahApiKey } from '@/lib/env'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { patientId?: string }
  const patientId = body.patientId ?? getDefaultPatientId()
  const base = getHebrahApiBaseUrl().replace(/\/$/, '')

  const response = await fetch(`${base}/v1/sandbox/scenarios/credentialing_verify_practitioner/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getHebrahApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ patient_id: patientId })
  })

  const text = await response.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {}

  if (!response.ok) {
    return NextResponse.json({ message: 'Scenario trigger failed', detail: parsed }, { status: response.status })
  }
  return NextResponse.json(parsed, { status: 202 })
}
