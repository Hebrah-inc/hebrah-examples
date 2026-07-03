import { NextResponse } from 'next/server'
import { getRelayMode, setRelayMode, type RelayMode } from '@/lib/relay-mode'
import { clearRelayStats, getRelayStats, listWebhookEvents } from '@/lib/webhook-store'

const MODES: RelayMode[] = ['healthy', '503', 'timeout', 'slow', '429', 'random']

export async function GET() {
  return NextResponse.json({
    mode: getRelayMode(),
    stats: getRelayStats(),
    events: listWebhookEvents(20)
  })
}

export async function POST(request: Request) {
  const body = await request.json() as {
    mode?: RelayMode
    failRate?: number
    slowMs?: number
    clear?: boolean
  }

  if (body.clear) {
    clearRelayStats()
  }

  if (body.mode && !MODES.includes(body.mode)) {
    return NextResponse.json({ message: 'Invalid mode' }, { status: 400 })
  }

  const mode = setRelayMode({
    mode: body.mode,
    failRate: body.failRate,
    slowMs: body.slowMs
  })

  return NextResponse.json({ mode, stats: getRelayStats() })
}
