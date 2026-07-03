import { NextResponse } from 'next/server'
import { getHebrahApiBaseUrl } from '@/lib/env'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    patientId?: string
    accessToken?: string
    iss?: string
  }

  if (!body.patientId || !body.accessToken) {
    return NextResponse.json({ message: 'patientId and accessToken are required' }, { status: 400 })
  }

  const issuer = (body.iss ?? getHebrahApiBaseUrl()).replace(/\/$/, '')
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
