'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function WritebackPanel() {
  const [loading, setLoading] = useState(false)

  async function run(action: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/writeback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const body = await res.json().catch(() => ({})) as { message?: string, status?: string }
      if (!res.ok) {
        throw new Error(body.message ?? `Write-back failed (${res.status})`)
      }
      toast.success(`Write-back ${body.status ?? 'accepted'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Write-back failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={loading} onClick={() => void run('chart-note')}>
        Chart note
      </Button>
      <Button variant="outline" disabled={loading} onClick={() => void run('order')}>
        Place order
      </Button>
      <Button variant="outline" disabled={loading} onClick={() => void run('task-response')}>
        Task response
      </Button>
    </div>
  )
}
