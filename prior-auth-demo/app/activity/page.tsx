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

interface PaActivityEntry {
  id: string
  at: string
  event: string
  patientId: string
  taskId?: string
  status?: string
}

const SCENARIOS = [
  { id: 'prior_auth_happy_path', label: 'Happy path' },
  { id: 'prior_auth_pend_then_approve', label: 'Pend then approve' },
  { id: 'prior_auth_denial', label: 'Denial' },
  { id: 'prior_auth_pend_with_eob', label: 'Pend with EOB' },
  { id: 'claim_denial_workflow', label: 'Claim denial' }
]

const HL7_TEMPLATES = [
  { id: 'dft_p03_prior_auth', label: 'PA HL7 inject' },
  { id: 'ref_i12_referral', label: 'Referral HL7 inject' },
  { id: 'dft_p03_claim', label: 'Claim HL7 inject' }
]

export default function ActivityPage() {
  const [feed, setFeed] = useState<PaActivityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [patientId, setPatientId] = useState('pat_00000000_01')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/activity')
      const data = await res.json() as { recent: PaActivityEntry[] }
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

  async function runScenario(scenarioId: string) {
    setTriggering(true)
    try {
      const res = await fetch('/api/mcp/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, patientId })
      })
      const body = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        throw new Error(body.message ?? `Scenario failed (${res.status})`)
      }
      toast.success(`Scenario ${scenarioId} queued via MCP`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Scenario failed')
    } finally {
      setTriggering(false)
    }
  }

  async function injectHl7(templateId: string) {
    setTriggering(true)
    try {
      const res = await fetch('/api/hl7/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, patientId })
      })
      const body = await res.json().catch(() => ({})) as { message?: string, event?: string }
      if (!res.ok) {
        throw new Error(body.message ?? `HL7 inject failed (${res.status})`)
      }
      toast.success(`HL7 inject queued (${body.event ?? templateId})`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'HL7 inject failed')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Prior auth activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run sandbox scenarios through hebrah hosted MCP; webhooks update the PA queue.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run scenarios via MCP</CardTitle>
          <CardDescription>
            Calls <code>run_sandbox_scenario</code> on hebrah-mcp-host
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
            {SCENARIOS.map(scenario => (
              <Button
                key={scenario.id}
                variant={scenario.id === 'prior_auth_denial' ? 'outline' : 'default'}
                disabled={triggering || !patientId.trim()}
                onClick={() => void runScenario(scenario.id)}
              >
                {scenario.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HL7 inject</CardTitle>
          <CardDescription>
            Calls <code>inject_hl7</code> via hosted MCP
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {HL7_TEMPLATES.map(template => (
            <Button
              key={template.id}
              variant="outline"
              disabled={triggering || !patientId.trim()}
              onClick={() => void injectHl7(template.id)}
            >
              {template.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event feed</CardTitle>
          <CardDescription>Prior auth events from signed webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prior auth events yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Task</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feed.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.event}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.patientId}</TableCell>
                    <TableCell className="font-mono text-xs">{row.taskId ?? '—'}</TableCell>
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
