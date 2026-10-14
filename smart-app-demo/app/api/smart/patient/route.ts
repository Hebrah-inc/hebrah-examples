import { NextResponse } from 'next/server'
import { resolveSafeIssuer } from '@/lib/env'

const PATIENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    patientId?: string
    accessToken?: string
    iss?: string
  }

  if (!body.patientId || !body.accessToken) {
    return NextResponse.json({ message: 'patientId and accessToken are required' }, { status: 400 })
  }

  if (!PATIENT_ID_PATTERN.test(body.patientId)) {
    return NextResponse.json({ message: 'Invalid patientId' }, { status: 400 })
  }

  let issuer: string
  try {
    issuer = resolveSafeIssuer(body.patientId ? body.iss : undefined)
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Invalid issuer' },
      { status: 400 }
    )
  }

  const response = await fetch(
    `${issuer}/fhir/R4/Patient/${encodeURIComponent(body.patientId)}`,
    {
      headers: { Authorization: `Bearer ${body.accessToken}` }
    }
  )

  const text = await response.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {}

  if (!response.ok) {
    return NextResponse.json({ message: 'FHIR request failed', detail: parsed }, { status: response.status })
  }

  return NextResponse.json(parsed)
}
