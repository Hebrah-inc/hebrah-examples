'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

interface PaQueueItem {
  taskId: string
  patientId: string
  status: string
  payerId?: string
  updatedAt: string
}

export default function QueuePage() {
  const [queue, setQueue] = useState<PaQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/queue')
      const data = await res.json() as { queue: PaQueueItem[] }
      setQueue(data.queue ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Prior auth queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open PA tasks derived from verified prior_auth.* webhook events.
          </p>
        </div>
        <Badge variant="secondary" className="text-base px-3 py-1">
          {queue.length} tasks
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active requests</CardTitle>
          <CardDescription>Updates every 3s · in-memory until restart</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : queue.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>No prior auth tasks yet.</p>
              <Link href="/activity" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Run a scenario on Activity
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map(row => (
                  <TableRow key={row.taskId}>
                    <TableCell className="font-mono text-xs">{row.taskId}</TableCell>
                    <TableCell>
                      <Link href={`/patients/${row.patientId}`} className="font-mono text-xs underline">
                        {row.patientId}
                      </Link>
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-xs">{row.payerId ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(row.updatedAt).toLocaleString()}
                    </TableCell>
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
