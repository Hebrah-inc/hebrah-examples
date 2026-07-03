import { NextResponse } from 'next/server'
import { listAggregatorEvents } from '@/lib/webhook-store'

export async function GET() {
  return NextResponse.json({ events: listAggregatorEvents() })
}
