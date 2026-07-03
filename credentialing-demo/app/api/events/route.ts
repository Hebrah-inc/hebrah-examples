import { NextResponse } from 'next/server'
import { listCredentialingEvents } from '@/lib/webhook-store'

export async function GET() {
  return NextResponse.json({ events: listCredentialingEvents() })
}
