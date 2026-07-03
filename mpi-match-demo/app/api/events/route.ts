import { NextResponse } from 'next/server'
import { listQueueEvents } from '@/lib/webhook-store'

export async function GET() {
  return NextResponse.json({ events: listQueueEvents() })
}
