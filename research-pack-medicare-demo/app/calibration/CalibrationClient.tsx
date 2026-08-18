'use client'

import { useCallback, useEffect, useState } from 'react'

type DrgRow = {
  code: string
  sandbox_share: number
  benchmark_share: number
  delta_share: number
  benchmark_avg_covered_charge?: number
  benchmark_avg_medicare_payment?: number
}

type ComparePayload = {
  as_of?: string
  source?: string
  attribution?: string
  disclaimer?: string
  sandbox?: {
    claim_count?: number
    denial_rate?: number
    medicare_share?: number
    institutional_share?: number
    avg_charge?: number
    avg_payment?: number
  }
  targets?: Record<string, { sandbox?: number, benchmark?: number, delta?: number }>
  drg_rows?: DrgRow[]
  error?: string
  detail?: string
}

export default function CalibrationClient() {
  const [compare, setCompare] = useState<ComparePayload | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadCompare = useCallback(async () => {
    setBusy('compare')
    setMessage(null)
    try {
      const res = await fetch('/api/hebrah/compare')
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Compare failed')
      setCompare(data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Compare failed')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    void loadCompare()
  }, [loadCompare])

  async function applyPack() {
    setBusy('apply')
    setMessage(null)
    try {
      const res = await fetch('/api/hebrah/apply', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Apply failed')
      setMessage(`Applied ${data.pack_id}. Remount: ${data.remount?.status || data.status}`)
      await loadCompare()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Apply failed')
    } finally {
      setBusy(null)
    }
  }

  async function runScenario() {
    setBusy('scenario')
    setMessage(null)
    try {
      const res = await fetch('/api/hebrah/scenario', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Scenario failed')
      setMessage(`Ran medicare_claim_paid_workflow for ${data.patientId}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scenario failed')
    } finally {
      setBusy(null)
    }
  }

  const sandbox = compare?.sandbox
  const targets = compare?.targets

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button type="button" onClick={() => void applyPack()} disabled={Boolean(busy)}>
          {busy === 'apply' ? 'Applying…' : 'Apply Research Pack'}
        </button>
        <button type="button" onClick={() => void loadCompare()} disabled={Boolean(busy)}>
          {busy === 'compare' ? 'Loading…' : 'Refresh compare'}
        </button>
        <button type="button" onClick={() => void runScenario()} disabled={Boolean(busy)}>
          {busy === 'scenario' ? 'Running…' : 'Run medicare_claim_paid_workflow'}
        </button>
      </div>

      {message ? <p style={{ color: '#333' }}>{message}</p> : null}

      {sandbox ? (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2>Sandbox KPIs</h2>
          <ul>
            <li>Claims: {sandbox.claim_count}</li>
            <li>Denial rate: {sandbox.denial_rate} (benchmark {targets?.denial_rate?.benchmark}, Δ {targets?.denial_rate?.delta})</li>
            <li>Medicare share: {sandbox.medicare_share} (benchmark {targets?.medicare_share?.benchmark}, Δ {targets?.medicare_share?.delta})</li>
            <li>Institutional share: {sandbox.institutional_share}</li>
            <li>Avg charge / payment: ${sandbox.avg_charge} / ${sandbox.avg_payment}</li>
          </ul>
          <p style={{ fontSize: '0.85rem', color: '#555' }}>
            Benchmark as of {compare?.as_of}. {compare?.source}
          </p>
        </section>
      ) : null}

      <section>
        <h2>DRG mix vs CMS snapshot</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th align="left">MS-DRG</th>
              <th align="right">Sandbox share</th>
              <th align="right">CMS share</th>
              <th align="right">Δ share</th>
              <th align="right">CMS avg payment</th>
            </tr>
          </thead>
          <tbody>
            {(compare?.drg_rows || []).map((row) => (
              <tr key={row.code} style={{ borderTop: '1px solid #eee' }}>
                <td>{row.code}</td>
                <td align="right">{(row.sandbox_share * 100).toFixed(1)}%</td>
                <td align="right">{(row.benchmark_share * 100).toFixed(1)}%</td>
                <td align="right">{(row.delta_share * 100).toFixed(1)}pp</td>
                <td align="right">
                  {row.benchmark_avg_medicare_payment != null
                    ? `$${row.benchmark_avg_medicare_payment.toLocaleString()}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!compare?.drg_rows?.length ? (
          <p style={{ color: '#666' }}>No rows yet — apply the Research Pack, then refresh.</p>
        ) : null}
      </section>

      {compare?.disclaimer ? (
        <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#666' }}>{compare.disclaimer}</p>
      ) : null}
    </div>
  )
}
