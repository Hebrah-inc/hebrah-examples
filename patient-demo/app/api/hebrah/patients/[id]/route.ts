import { NextResponse } from 'next/server'
import { fetchPatient } from '@/lib/hebrah-api'
import { HebrahApiError } from '@/lib/hebrah-api'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const patient = await fetchPatient(id)
    return NextResponse.json({ patient })
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
