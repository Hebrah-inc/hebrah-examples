import { NextResponse } from 'next/server'
import { getAdtFeed, getCensus } from '@/lib/webhook-store'

export async function GET() {
  return NextResponse.json({
    admitted: getCensus(),
    recent: getAdtFeed()
  })
}
