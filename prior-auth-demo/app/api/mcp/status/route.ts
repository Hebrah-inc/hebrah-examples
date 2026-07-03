import { NextResponse } from 'next/server'
import { mcpGetAccountStatus } from '@/lib/mcp-client'

export async function GET() {
  try {
    const status = await mcpGetAccountStatus()
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
