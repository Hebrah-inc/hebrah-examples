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

interface CensusPatient {
  patientId: string
  patientName?: string
  admittedAt: string
}

export default function CensusPage() {
  const [admitted, setAdmitted] = useState<CensusPatient[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/census')
      const data = await res.json() as { admitted: CensusPatient[] }
      setAdmitted(data.admitted ?? [])
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
          <h2 className="text-2xl font-semibold tracking-tight">Current census</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Patients currently admitted based on verified webhook events.
          </p>
        </div>
        <Badge variant="secondary" className="text-base px-3 py-1">
          {admitted.length} admitted
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>In hospital</CardTitle>
          <CardDescription>Updates every 3s · in-memory until restart</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && admitted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : admitted.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>No admitted patients yet.</p>
              <Link href="/activity" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Simulate admit on Activity
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Admitted at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admitted.map(row => (
                  <TableRow key={row.patientId}>
                    <TableCell>{row.patientName ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.patientId}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(row.admittedAt).toLocaleString()}
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
