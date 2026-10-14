import { NextResponse } from 'next/server'
import { HebrahApiError, HebrahClient } from '@hebrah/sdk'
import { getHebrahApiBaseUrl, getHebrahApiKey } from '@/lib/env'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    patient_id?: string
    include_consent?: boolean
    include_provenance?: boolean
  }

  if (!body.patient_id) {
    return NextResponse.json({ message: 'patient_id is required' }, { status: 400 })
  }

  const client = new HebrahClient({
    apiKey: getHebrahApiKey(),
    baseUrl: getHebrahApiBaseUrl(),
    defaultConnectionId: process.env.HEBRAH_CONNECTION_ID || undefined,
    environmentId: process.env.HEBRAH_ENVIRONMENT_ID || undefined
  })

  try {
    const result = await client.sandbox.runAggregatorQuery({
      patientId: body.patient_id,
      includeConsent: body.include_consent ?? true,
      includeProvenance: body.include_provenance ?? true
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof HebrahApiError) {
      return NextResponse.json(
        { message: 'Aggregator query failed', detail: err.detail ?? err.message },
        { status: err.status }
      )
    }
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Aggregator query failed' },
      { status: 500 }
    )
  }
}
