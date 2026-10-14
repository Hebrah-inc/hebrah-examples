import { NextResponse } from 'next/server'
import { HebrahApiError, HebrahClient } from '@hebrah/sdk'
import { getDefaultPatientId, getHebrahApiBaseUrl, getHebrahApiKey } from '@/lib/env'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { patientId?: string }
  const patientId = body.patientId ?? getDefaultPatientId()

  const client = new HebrahClient({
    apiKey: getHebrahApiKey(),
    baseUrl: getHebrahApiBaseUrl(),
    defaultConnectionId: process.env.HEBRAH_CONNECTION_ID || undefined,
    environmentId: process.env.HEBRAH_ENVIRONMENT_ID || undefined
  })

  try {
    const result = await client.sandbox.runScenario('credentialing_verify_practitioner', { patientId })
    return NextResponse.json(result, { status: 202 })
  } catch (err) {
    if (err instanceof HebrahApiError) {
      return NextResponse.json(
        { message: 'Scenario trigger failed', detail: err.detail ?? err.message },
        { status: err.status }
      )
    }
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Scenario trigger failed' },
      { status: 500 }
    )
  }
}
