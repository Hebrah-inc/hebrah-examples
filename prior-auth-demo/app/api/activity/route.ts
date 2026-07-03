import { NextResponse } from 'next/server'
import { getPaActivity } from '@/lib/webhook-store'

export async function GET() {
  return NextResponse.json({ recent: getPaActivity() })
}
