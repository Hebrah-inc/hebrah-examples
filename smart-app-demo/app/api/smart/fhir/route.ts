import { NextResponse } from 'next/server'
import { resolveSafeIssuer } from '@/lib/env'

const ALLOWED_METHODS = new Set(['GET', 'POST'])

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

  const cleanPath = body.path.replace(/^\//, '')
  if (cleanPath.includes('..') || cleanPath.includes('//') || cleanPath.startsWith('http')) {
    return NextResponse.json({ message: 'Invalid FHIR path' }, { status: 400 })
  }

  const method = (body.method ?? 'GET').toUpperCase()
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ message: 'Unsupported HTTP method' }, { status: 400 })
  }

  let issuer: string
  try {
    issuer = resolveSafeIssuer(body.iss)
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Invalid issuer' },
      { status: 400 }
    )
  }

  const url = `${issuer}/fhir/R4/${cleanPath}`

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
