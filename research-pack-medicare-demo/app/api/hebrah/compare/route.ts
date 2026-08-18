import { NextResponse } from 'next/server'
import { compareResearchPack, HebrahApiError } from '@/lib/hebrah-api'

export async function GET() {
  try {
    const result = await compareResearchPack()
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof HebrahApiError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
