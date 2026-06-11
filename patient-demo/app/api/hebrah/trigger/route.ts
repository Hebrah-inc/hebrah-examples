import { NextResponse } from 'next/server'
import { triggerMockEvent } from '@/lib/hebrah-api'
import { HebrahApiError } from '@/lib/hebrah-api'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { event?: string, patientId?: string }
    if (!body.event) {
      return NextResponse.json({ message: 'event is required' }, { status: 400 })
    }
    const result = await triggerMockEvent(body.event, body.patientId)
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (error instanceof HebrahApiError) {
      return NextResponse.json(
        { message: error.message, detail: error.detail },
        { status: error.status }
      )
    }
    if (error instanceof Error && error.message.includes('HEBRAH_SANDBOX_API_KEY')) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    throw error
  }
}
