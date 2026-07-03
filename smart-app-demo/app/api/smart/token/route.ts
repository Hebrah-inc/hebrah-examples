import { NextResponse } from 'next/server'
import { getHebrahApiBaseUrl, getSmartClientId, getSmartRedirectUri } from '@/lib/env'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string
    codeVerifier?: string
    iss?: string
  }

  if (!body.code || !body.codeVerifier) {
    return NextResponse.json({ message: 'code and codeVerifier are required' }, { status: 400 })
  }

  const issuer = (body.iss ?? getHebrahApiBaseUrl()).replace(/\/$/, '')
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code: body.code,
    redirect_uri: getSmartRedirectUri(),
    client_id: getSmartClientId(),
    code_verifier: body.codeVerifier
  })

  const response = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  })

  const text = await response.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {}

  if (!response.ok) {
    return NextResponse.json({ message: 'Token exchange failed', detail: parsed }, { status: response.status })
  }

  return NextResponse.json(parsed)
}
