import { NextResponse } from 'next/server'
import { applyResearchPack, HebrahApiError } from '@/lib/hebrah-api'

export async function POST() {
  try {
    const result = await applyResearchPack()
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof HebrahApiError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
