'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function PatientActions({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function trigger(event: string) {
    setLoading(event)
    try {
      const res = await fetch('/api/hebrah/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, patientId })
      })
      const body = await res.json().catch(() => ({})) as { message?: string, status?: string }
      if (!res.ok) {
        throw new Error(body.message ?? `Trigger failed (${res.status})`)
      }
      toast.success(`Queued ${event}`, {
        description: body.status ?? '202 Accepted'
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trigger failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={Boolean(loading)}
        onClick={() => trigger('patient.admitted')}
      >
        {loading === 'patient.admitted' ? 'Sending…' : 'Admit patient'}
      </Button>
      <Button
        variant="outline"
        disabled={Boolean(loading)}
        onClick={() => trigger('patient.discharged')}
      >
        {loading === 'patient.discharged' ? 'Sending…' : 'Discharge patient'}
      </Button>
    </div>
  )
}
