'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

interface WebhookEvent {
  id: string
  receivedAt: string
  event: string
  connectionId: string
  environment: string
  orgId: string
  resourceType?: string
}

const CLINICAL_EVENTS = [
  'patient.created',
  'patient.updated',
  'patient.admitted',
  'patient.discharged',
  'encounter.created',
  'observation.created'
]

export default function EventsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [eventType, setEventType] = useState('patient.admitted')
  const [patientId, setPatientId] = useState('pat_00000000_01')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhooks/events')
      const data = await res.json() as { events: WebhookEvent[] }
      setEvents(data.events ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  async function triggerEvent() {
    setTriggering(true)
    try {
      const res = await fetch('/api/hebrah/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventType, patientId })
      })
      const body = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        throw new Error(body.message ?? `Trigger failed (${res.status})`)
      }
      toast.success('Mock event queued')
      await loadEvents()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trigger failed')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inbound webhooks received at this demo app and outbound mock event triggers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trigger mock event</CardTitle>
          <CardDescription>
            Calls `POST /v1/webhooks/trigger-mock-event` on the control plane
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Event</label>
            <Select value={eventType} onValueChange={value => value && setEventType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLINICAL_EVENTS.map(event => (
                  <SelectItem key={event} value={event}>
                    {event}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Patient ID</label>
            <Input
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              placeholder="pat_00000000_01"
            />
          </div>
          <Button disabled={triggering} onClick={triggerEvent}>
            {triggering ? 'Sending…' : 'Send test webhook'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Inbound webhooks</CardTitle>
            <CardDescription>Verified deliveries to `/api/webhooks/hebrah`</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={loading} onClick={loadEvents}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Connection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map(event => (
                <TableRow key={event.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(event.receivedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.event}</Badge>
                  </TableCell>
                  <TableCell>{event.resourceType ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{event.connectionId}</TableCell>
                </TableRow>
              ))}
              {!events.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No webhooks received yet. Register this app&apos;s webhook URL in While Settings,
                    then trigger an event.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
