'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

interface AdtFeedEntry {
  id: string
  at: string
  event: 'patient.admitted' | 'patient.discharged'
  patientId: string
  patientName?: string
}

export default function ActivityPage() {
  const [feed, setFeed] = useState<AdtFeedEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [patientId, setPatientId] = useState('pat_00000000_01')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/census')
      const data = await res.json() as { recent: AdtFeedEntry[] }
      setFeed(data.recent ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [load])

  async function trigger(event: 'patient.admitted' | 'patient.discharged') {
    setTriggering(true)
    try {
      const res = await fetch('/api/mcp/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, patientId })
      })
      const body = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        throw new Error(body.message ?? `Trigger failed (${res.status})`)
      }
      toast.success(event === 'patient.admitted' ? 'Admit triggered via MCP' : 'Discharge triggered via MCP')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trigger failed')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">ADT activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fire sandbox clinical events through hebrah hosted MCP; webhooks update census.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulate via MCP</CardTitle>
          <CardDescription>
            Calls hebrah-mcp-host <code>trigger_test_webhook</code> → hebrah-api → this app webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="patientId">
                Patient ID
              </label>
              <Input
                id="patientId"
                value={patientId}
                onChange={e => setPatientId(e.target.value)}
                className="font-mono text-xs w-56"
              />
            </div>
            <Button
              disabled={triggering || !patientId.trim()}
              onClick={() => void trigger('patient.admitted')}
            >
              Simulate admit
            </Button>
            <Button
              variant="outline"
              disabled={triggering || !patientId.trim()}
              onClick={() => void trigger('patient.discharged')}
            >
              Simulate discharge
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event feed</CardTitle>
          <CardDescription>Admit and discharge events from webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ADT events yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feed.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.event === 'patient.admitted' ? 'default' : 'secondary'}
                      >
                        {row.event}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.patientName ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.patientId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}