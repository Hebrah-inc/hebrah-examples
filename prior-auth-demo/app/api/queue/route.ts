import { NextResponse } from 'next/server'
import { getPaQueue } from '@/lib/webhook-store'

export async function GET() {
  return NextResponse.json({ queue: getPaQueue() })
}
