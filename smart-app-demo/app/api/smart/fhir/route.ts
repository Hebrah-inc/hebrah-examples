import { NextResponse } from 'next/server'
import { getHebrahApiBaseUrl } from '@/lib/env'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    path?: string
    accessToken?: string
    iss?: string
    method?: string
    payload?: unknown
  }

  if (!body.path || !body.accessToken) {
    return NextResponse.json({ message: 'path and accessToken are required' }, { status: 400 })
  }

  const issuer = (body.iss ?? getHebrahApiBaseUrl()).replace(/\/$/, '')
  const method = (body.method ?? 'GET').toUpperCase()
  const url = `${issuer}/fhir/R4/${body.path.replace(/^\//, '')}`

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${body.accessToken}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/fhir+json' } : {})
    },
    body: method === 'POST' ? JSON.stringify(body.payload ?? {}) : undefined
  })

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
