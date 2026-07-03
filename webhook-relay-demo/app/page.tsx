'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type RelayMode = 'healthy' | '503' | 'timeout' | 'slow' | '429' | 'random'

interface RelayState {
  mode: { mode: RelayMode, failRate: number, slowMs: number }
  stats: { acceptedCount: number, rejectedCount: number, total: number }
  events: Array<{
    id: string
    receivedAt: string
    event: string
    statusCode: number
    deliveryId?: string
  }>
}

const MODES: RelayMode[] = ['healthy', '503', 'slow', '429', 'random', 'timeout']

export default function RelayDashboardPage() {
  const [state, setState] = useState<RelayState | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/mode')
    setState(await res.json())
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  async function setMode(mode: RelayMode) {
    setLoading(true)
    try {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  async function clearOutage() {
    setLoading(true)
    try {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'healthy', clear: true })
      })
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhook Relay Demo</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Fault-injection receiver on port 3004 for hebrah webhook reliability testing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fault mode</CardTitle>
          <CardDescription>
            Point hebrah Settings → Webhook URL to
            {' '}
            <code className="text-xs">http://localhost:3004/api/webhooks/hebrah</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MODES.map(mode => (
            <Button
              key={mode}
              variant={state?.mode.mode === mode ? 'default' : 'outline'}
              size="sm"
              disabled={loading}
              onClick={() => void setMode(mode)}
            >
              {mode}
            </Button>
          ))}
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => void clearOutage()}>
            Clear outage
          </Button>
        </CardContent>
      </Card>

      {state && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Accepted</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{state.stats.acceptedCount}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Rejected</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{state.stats.rejectedCount}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Current mode</CardTitle></CardHeader>
            <CardContent><Badge>{state.mode.mode}</Badge></CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Recent delivery attempts (accepted and rejected)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(state?.events ?? []).map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">{new Date(item.receivedAt).toLocaleTimeString()}</TableCell>
                  <TableCell>{item.event}</TableCell>
                  <TableCell>
                    <Badge variant={item.statusCode >= 200 && item.statusCode < 300 ? 'default' : 'destructive'}>
                      {item.statusCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.deliveryId ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
