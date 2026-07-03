'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ClaimBundle {
  claim: Record<string, unknown> | null
  claimResponse: Record<string, unknown> | null
  eob: Record<string, unknown> | null
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const [patientId, setPatientId] = useState('')
  const [items, setItems] = useState<Array<{ taskId: string, status: string, payerId?: string }>>([])
  const [claims, setClaims] = useState<ClaimBundle | null>(null)

  useEffect(() => {
    void params.then(p => setPatientId(p.id))
  }, [params])

  useEffect(() => {
    if (!patientId) return
    void fetch('/api/queue')
      .then(res => res.json())
      .then(data => {
        const queue = (data.queue ?? []) as Array<{ taskId: string, patientId: string, status: string, payerId?: string }>
        setItems(queue.filter(row => row.patientId === patientId))
      })
    void fetch(`/api/claims?patientId=${encodeURIComponent(patientId)}`)
      .then(res => res.json())
      .then(data => {
        setClaims({
          claim: data.claim ?? null,
          claimResponse: data.claimResponse ?? null,
          eob: data.eob ?? null
        })
      })
  }, [patientId])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Patient context</h2>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{patientId}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prior auth requests</CardTitle>
          <CardDescription>Tasks for this patient from webhook events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No PA tasks for this patient.</p>
          ) : (
            items.map(item => (
              <div key={item.taskId} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-mono text-xs">{item.taskId}</span>
                <Badge variant="secondary">{item.status}</Badge>
              </div>
            ))
          )}
          <Link href="/queue" className="text-sm underline text-muted-foreground">
            Back to queue
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claims / EOB</CardTitle>
          <CardDescription>Synthetic Claim, ClaimResponse, and EOB from sandbox resources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {claims?.claim ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(claims.claim, null, 2)}</pre>
          ) : (
            <p className="text-muted-foreground">No Claim resource loaded.</p>
          )}
          {claims?.claimResponse ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(claims.claimResponse, null, 2)}</pre>
          ) : null}
          {claims?.eob ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(claims.eob, null, 2)}</pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
