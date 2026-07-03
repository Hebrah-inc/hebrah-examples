'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface WebhookEvent {
  id: string
  receivedAt: string
  event: string
  connectionId: string
  environment: string
  orgId: string
  resourceType?: string
  patientId?: string
}

const POLL_INTERVAL_MS = 2000

export default function EventsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [eventFilter, setEventFilter] = useState('')

  const eventTypes = useMemo(() => {
    const types = new Set(events.map(e => e.event).filter(Boolean))
    return Array.from(types).sort()
  }, [events])

  const filteredEvents = useMemo(() => {
    if (!eventFilter) return events
    return events.filter(e => e.event === eventFilter)
  }, [events, eventFilter])

  const loadEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/webhooks/events')
      const data = await res.json() as { events: WebhookEvent[] }
      setEvents(data.events ?? [])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
    const interval = setInterval(() => {
      void loadEvents(true)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadEvents])

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Webhook inbox</h2>
        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={loading}
          style={{ padding: '0.35rem 0.75rem', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Auto-refreshes every {POLL_INTERVAL_MS / 1000}s. Scenario events may arrive ~1s apart.
      </p>
      {eventTypes.length > 0 && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          Filter by event
          <select
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <option value="">All ({events.length})</option>
            {eventTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
      )}
      {filteredEvents.length === 0 && (
        <p>No events yet. Register webhook URL and run a scenario from <a href="/clinical">Clinical</a>.</p>
      )}
      {filteredEvents.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '0.5rem' }}>Received</th>
              <th style={{ padding: '0.5rem' }}>Event</th>
              <th style={{ padding: '0.5rem' }}>Patient</th>
              <th style={{ padding: '0.5rem' }}>Resource</th>
              <th style={{ padding: '0.5rem' }}>Connection</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                  {new Date(e.receivedAt).toLocaleString()}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: '#eef2ff',
                    color: '#3730a3',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}>
                    {e.event}
                  </span>
                </td>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {e.patientId ? (
                    <a href={`/chart/${encodeURIComponent(e.patientId)}`}>{e.patientId}</a>
                  ) : '—'}
                </td>
                <td style={{ padding: '0.5rem' }}>{e.resourceType ?? '—'}</td>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {e.connectionId || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
