'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function randomString(length = 48) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let value = ''
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  for (const b of bytes) {
    value += chars[b % chars.length]
  }
  return value
}

async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default function SmartAppDemoPage() {
  const query = useSearchParams()
  const [iss, setIss] = useState(process.env.NEXT_PUBLIC_HEBRAH_API_BASE_URL ?? 'http://localhost:8000')
  const [launch, setLaunch] = useState('')
  const [codeVerifier, setCodeVerifier] = useState('')
  const [token, setToken] = useState<Record<string, unknown> | null>(null)
  const [patient, setPatient] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const code = query.get('code') ?? ''
  const state = query.get('state') ?? ''

  useEffect(() => {
    const persistedVerifier = sessionStorage.getItem('smart_code_verifier')
    if (persistedVerifier) {
      setCodeVerifier(persistedVerifier)
    }
    const issFromQuery = query.get('iss')
    const launchFromQuery = query.get('launch')
    if (issFromQuery) setIss(issFromQuery)
    if (launchFromQuery) setLaunch(launchFromQuery)
  }, [query])

  const authorizeHref = useMemo(() => {
    if (!iss || !launch) return ''
    return `${iss.replace(/\/$/, '')}/oauth/authorize`
  }, [iss, launch])

  async function startLaunch() {
    setError(null)
    const verifier = randomString()
    const challenge = await pkceChallenge(verifier)
    setCodeVerifier(verifier)
    sessionStorage.setItem('smart_code_verifier', verifier)

    const redirectUri = process.env.NEXT_PUBLIC_SMART_REDIRECT_URI ?? 'http://localhost:3005'
    const clientId = process.env.NEXT_PUBLIC_SMART_CLIENT_ID ?? 'sandbox-smart-client'
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'launch/patient patient/*.read openid fhirUser',
      state: crypto.randomUUID(),
      launch,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    })
    window.location.href = `${authorizeHref}?${params.toString()}`
  }

  async function exchangeCode() {
    if (!code) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/smart/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier, iss })
      })
      const json = await response.json()
      if (!response.ok) {
        setError(String(json?.message ?? 'Token exchange failed'))
        return
      }
      setToken(json as Record<string, unknown>)
    } finally {
      setLoading(false)
    }
  }

  async function loadPatient() {
    if (!token?.access_token || !token?.patient) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/smart/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: token.patient,
          accessToken: token.access_token,
          iss
        })
      })
      const json = await response.json()
      if (!response.ok) {
        setError(String(json?.message ?? 'FHIR request failed'))
        return
      }
      setPatient(json as Record<string, unknown>)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">SMART App Demo</h1>
        <p className="text-sm text-gray-600">
          Paste launch context from dashboard or manual SMART launch URL, then complete OAuth code exchange.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">1) Start launch</h2>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={iss}
          onChange={e => setIss(e.target.value)}
          placeholder="iss (e.g. http://localhost:8000)"
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={launch}
          onChange={e => setLaunch(e.target.value)}
          placeholder="launch token"
        />
        <button
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => void startLaunch()}
          disabled={!authorizeHref || !launch}
        >
          Start SMART authorization
        </button>
        <p className="text-xs text-gray-500">
          Dashboard link support: `.../oauth/authorize?launch=...&iss=...`
        </p>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">2) Exchange code for token</h2>
        <p className="text-xs text-gray-600 break-all">code: {code || '—'} | state: {state || '—'}</p>
        <button
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => void exchangeCode()}
          disabled={!code || !codeVerifier || loading}
        >
          Exchange code
        </button>
        {token && <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs">{JSON.stringify(token, null, 2)}</pre>}
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">3) Read FHIR patient</h2>
        <button
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => void loadPatient()}
          disabled={!token?.access_token || loading}
        >
          GET /fhir/R4/Patient/{String(token?.patient ?? '{id}')}
        </button>
        {patient && (
          <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs">{JSON.stringify(patient, null, 2)}</pre>
        )}
      </section>

      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <p className="text-xs text-gray-600">
        Register webhook URL in hebrah: <code>{process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3005'}/api/webhooks/hebrah</code>
      </p>
      <Link href="https://docs.smarthealthit.org/authorization/" className="text-xs underline">
        SMART authorization reference
      </Link>
    </div>
  )
}
