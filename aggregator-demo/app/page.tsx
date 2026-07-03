'use client'

import { useEffect, useState } from 'react'

interface AggregatorEvent {
  id: string
  receivedAt: string
  event: string
}

export default function AggregatorDemoPage() {
  const [patientId, setPatientId] = useState('pat_00000000_01')
  const [includeConsent, setIncludeConsent] = useState(true)
  const [includeProvenance, setIncludeProvenance] = useState(true)
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null)
  const [events, setEvents] = useState<AggregatorEvent[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refreshEvents() {
    const response = await fetch('/api/events')
    const json = (await response.json()) as { events: AggregatorEvent[] }
    setEvents(json.events ?? [])
  }

  useEffect(() => {
    void refreshEvents()
    const id = setInterval(() => void refreshEvents(), 3000)
    return () => clearInterval(id)
  }, [])

  async function submitQuery() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          include_consent: includeConsent,
          include_provenance: includeProvenance
        })
      })
      const json = await response.json()
      if (!response.ok) {
        setMessage(String(json?.message ?? 'Query failed'))
        return
      }
      setBundle(json as Record<string, unknown>)
      setMessage('Aggregator query completed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Aggregator Demo</h1>
      <p className="text-sm text-gray-600">
        Query proxy to <code>/v1/sandbox/aggregator/query</code> plus webhook inbox for <code>aggregator.*</code>.
      </p>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Query form</h2>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          placeholder="patient id"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeConsent} onChange={e => setIncludeConsent(e.target.checked)} />
          include_consent
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeProvenance}
            onChange={e => setIncludeProvenance(e.target.checked)}
          />
          include_provenance
        </label>
        <button
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => void submitQuery()}
          disabled={busy}
        >
          Run aggregator query
        </button>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Consolidated bundle</h2>
        <pre className="max-h-80 overflow-auto rounded bg-gray-100 p-3 text-xs">
          {bundle ? JSON.stringify(bundle, null, 2) : 'No query response yet.'}
        </pre>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium">Webhook inbox</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Event</th>
              </tr>
            </thead>
            <tbody>
              {events.map(item => (
                <tr key={item.id} className="border-b">
                  <td className="py-2 pr-3">{new Date(item.receivedAt).toLocaleTimeString()}</td>
                  <td className="py-2 pr-3">{item.event}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td className="py-2 text-gray-500" colSpan={2}>No aggregator events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
