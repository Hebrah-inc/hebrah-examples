import { NextResponse } from 'next/server'
import { listWebhookEvents } from '@/lib/webhook-store'

export async function GET() {
  return NextResponse.json({ events: listWebhookEvents() })
}
