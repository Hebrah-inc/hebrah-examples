'use client'

import { useEffect, useState } from 'react'

interface CredentialingEvent {
  id: string
  receivedAt: string
  event: string
}

export default function CredentialingDemoPage() {
  const [patientId, setPatientId] = useState('pat_00000000_01')
  const [events, setEvents] = useState<CredentialingEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh() {
    const response = await fetch('/api/events')
    const json = (await response.json()) as { events: CredentialingEvent[] }
    setEvents(json.events ?? [])
  }

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 3000)
    return () => clearInterval(id)
  }, [])

  async function triggerScenario() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId })
      })
      const json = await response.json()
      setMessage(response.ok ? 'Triggered credentialing_verify_practitioner' : String(json?.message ?? 'Trigger failed'))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Credentialing Demo</h1>
      <p className="text-sm text-gray-600">
        Minimal queue for <code>credentialing.*</code> webhooks plus scenario trigger.
      </p>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Trigger scenario</h2>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          placeholder="patient id"
        />
        <button
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => void triggerScenario()}
          disabled={busy}
        >
          Trigger credentialing_verify_practitioner
        </button>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium">Credentialing inbox</h2>
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
                  <td className="py-2 text-gray-500" colSpan={2}>No credentialing events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
