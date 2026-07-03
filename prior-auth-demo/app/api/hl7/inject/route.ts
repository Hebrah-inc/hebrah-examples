import { mcpInjectHl7 } from '@/lib/mcp-client'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      templateId?: string
      patientId?: string
      message?: string
    }
    const result = await mcpInjectHl7({
      templateId: body.templateId ?? 'dft_p03_prior_auth',
      patientId: body.patientId,
      message: body.message
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'HL7 inject failed' },
      { status: 500 }
    )
  }
}
