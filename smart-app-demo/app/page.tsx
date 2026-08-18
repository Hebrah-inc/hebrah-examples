'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type TabId =
  | 'profile'
  | 'problems'
  | 'meds'
  | 'allergies'
  | 'vitals'
  | 'labs'
  | 'visits'
  | 'documents'
  | 'messages'

interface SmartToken {
  access_token?: string
  patient?: string
  id_token?: string
  refresh_token?: string
}

const TABS: { id: TabId; label: string; path: (patientId: string) => string }[] = [
  { id: 'profile', label: 'Profile', path: id => `Patient/${id}` },
  { id: 'problems', label: 'Problems', path: id => `Condition?patient=${id}` },
  { id: 'meds', label: 'Meds', path: id => `MedicationRequest?patient=${id}&category=homemeds` },
  { id: 'allergies', label: 'Allergies', path: id => `AllergyIntolerance?patient=${id}` },
  { id: 'vitals', label: 'Vitals', path: id => `Observation?patient=${id}&category=vital-signs` },
  { id: 'labs', label: 'Labs', path: id => `Observation?patient=${id}&category=laboratory` },
  { id: 'visits', label: 'Visits', path: id => `Encounter?patient=${id}` },
  { id: 'documents', label: 'Documents', path: id => `DocumentReference?patient=${id}` },
  { id: 'messages', label: 'Messages', path: id => `Communication?patient=${id}` }
]

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

async function fhirRequest(
  path: string,
  accessToken: string,
  iss: string,
  method = 'GET',
  payload?: unknown
) {
  const response = await fetch('/api/smart/fhir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, accessToken, iss, method, payload })
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(String(json?.message ?? 'FHIR request failed'))
  }
  return json
}

export default function SmartAppDemoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-600">Loading SMART demo…</p>}>
      <SmartAppDemoContent />
    </Suspense>
  )
}

function SmartAppDemoContent() {
  const query = useSearchParams()
  const [iss, setIss] = useState(process.env.NEXT_PUBLIC_HEBRAH_API_BASE_URL ?? 'http://localhost:8000')
  const [launch, setLaunch] = useState('')
  const [standalonePatientId, setStandalonePatientId] = useState('')
  const [launchMode, setLaunchMode] = useState<'mychart' | 'standalone'>('mychart')
  const [codeVerifier, setCodeVerifier] = useState('')
  const [token, setToken] = useState<SmartToken | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [tabData, setTabData] = useState<Record<string, unknown> | null>(null)
  const [binaryData, setBinaryData] = useState<Record<string, unknown>[]>([])
  const [vitalValue, setVitalValue] = useState('120/80')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const code = query.get('code') ?? ''
  const patientId = token?.patient ?? ''
  const accessToken = token?.access_token ?? ''

  useEffect(() => {
    const persistedVerifier = sessionStorage.getItem('smart_code_verifier')
    if (persistedVerifier) setCodeVerifier(persistedVerifier)
    const issFromQuery = query.get('iss')
    const launchFromQuery = query.get('launch')
    if (issFromQuery) setIss(issFromQuery)
    if (launchFromQuery) setLaunch(launchFromQuery)
  }, [query])

  const authorizeHref = useMemo(() => `${iss.replace(/\/$/, '')}/oauth/authorize`, [iss])

  async function startLaunch() {
    setError(null)
    const verifier = randomString()
    const challenge = await pkceChallenge(verifier)
    setCodeVerifier(verifier)
    sessionStorage.setItem('smart_code_verifier', verifier)

    const redirectUri = process.env.NEXT_PUBLIC_SMART_REDIRECT_URI ?? 'http://localhost:3005'
    const clientId = process.env.NEXT_PUBLIC_SMART_CLIENT_ID ?? 'sandbox-smart-client'
    const scope =
      launchMode === 'standalone'
        ? 'patient/*.read patient/Observation.write openid fhirUser offline_access'
        : 'launch/patient patient/*.read patient/Observation.write openid fhirUser offline_access'

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state: crypto.randomUUID(),
      code_challenge: challenge,
      code_challenge_method: 'S256'
    })

    if (launchMode === 'mychart') {
      if (!launch) {
        setError('Launch token required for MyChart mode')
        return
      }
      params.set('launch', launch)
    } else if (standalonePatientId.trim()) {
      params.set('patient_id', standalonePatientId.trim())
    }

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
      setToken(json as SmartToken)
    } finally {
      setLoading(false)
    }
  }

  async function loadTab(tab: TabId) {
    if (!accessToken || !patientId) return
    setLoading(true)
    setError(null)
    setBinaryData([])
    try {
      const tabDef = TABS.find(t => t.id === tab)
      if (!tabDef) return
      const json = await fhirRequest(tabDef.path(patientId), accessToken, iss)
      setTabData(json as Record<string, unknown>)

      if (tab === 'documents' && json && typeof json === 'object' && Array.isArray((json as { entry?: unknown[] }).entry)) {
        const binaries: Record<string, unknown>[] = []
        for (const entry of (json as { entry: { resource?: { content?: { attachment?: { url?: string } }[] } }[] }).entry) {
          const url = entry.resource?.content?.[0]?.attachment?.url
          if (url?.startsWith('Binary/')) {
            const binaryId = url.replace('Binary/', '')
            const binary = await fhirRequest(`Binary/${binaryId}?patient=${patientId}`, accessToken, iss)
            binaries.push(binary as Record<string, unknown>)
          }
        }
        setBinaryData(binaries)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FHIR request failed')
    } finally {
      setLoading(false)
    }
  }

  async function submitVital() {
    if (!accessToken || !patientId) return
    setLoading(true)
    setError(null)
    try {
      const payload = {
        resourceType: 'Observation',
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs'
              }
            ]
          }
        ],
        code: {
          coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }]
        },
        subject: { reference: `Patient/${patientId}` },
        valueString: vitalValue
      }
      await fhirRequest('Observation', accessToken, iss, 'POST', payload)
      setActiveTab('vitals')
      await loadTab('vitals')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vital')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (accessToken && patientId) {
      void loadTab(activeTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab, patientId])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Epic Patient Chart Demo</h1>
        <p className="text-sm text-gray-600">
          MyChart-style SMART launch with full patient chart tabs, Binary document fetch, and patient-entered vitals.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">1) SMART launch</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={launchMode === 'mychart'} onChange={() => setLaunchMode('mychart')} />
            MyChart launch
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={launchMode === 'standalone'} onChange={() => setLaunchMode('standalone')} />
            Standalone patient
          </label>
        </div>
        <input className="w-full rounded border px-3 py-2 text-sm" value={iss} onChange={e => setIss(e.target.value)} placeholder="iss" />
        {launchMode === 'mychart' ? (
          <input className="w-full rounded border px-3 py-2 text-sm" value={launch} onChange={e => setLaunch(e.target.value)} placeholder="launch token" />
        ) : (
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={standalonePatientId}
            onChange={e => setStandalonePatientId(e.target.value)}
            placeholder="patient_id (optional — defaults to org sandbox patient)"
          />
        )}
        <button className="rounded bg-black px-3 py-2 text-sm text-white" onClick={() => void startLaunch()}>
          Start SMART authorization
        </button>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">2) Token exchange</h2>
        <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60" onClick={() => void exchangeCode()} disabled={!code || !codeVerifier || loading}>
          Exchange code
        </button>
        {token && <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs">{JSON.stringify(token, null, 2)}</pre>}
      </section>

      {accessToken && (
        <section className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="font-medium">3) Patient chart</h2>
          <div className="flex flex-wrap gap-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`rounded px-3 py-1 text-sm ${activeTab === tab.id ? 'bg-black text-white' : 'bg-gray-100'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {tabData && <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs max-h-96">{JSON.stringify(tabData, null, 2)}</pre>}
          {binaryData.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Binary attachments</h3>
              {binaryData.map((binary, index) => (
                <pre key={index} className="overflow-x-auto rounded bg-gray-50 p-2 text-xs max-h-40">
                  {JSON.stringify({ id: binary.id, contentType: binary.contentType, dataPreview: String(binary.data ?? '').slice(0, 80) }, null, 2)}
                </pre>
              ))}
            </div>
          )}
        </section>
      )}

      {accessToken && (
        <section className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="font-medium">4) Submit patient-entered vital</h2>
          <input className="w-full rounded border px-3 py-2 text-sm" value={vitalValue} onChange={e => setVitalValue(e.target.value)} />
          <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60" onClick={() => void submitVital()} disabled={loading}>
            POST Observation (vital-signs)
          </button>
        </section>
      )}

      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Link href="https://fhir.epic.com/Specifications" className="text-xs underline">
        Epic on FHIR specifications
      </Link>
    </div>
  )
}
