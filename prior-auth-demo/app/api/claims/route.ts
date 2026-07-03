import { mcpGetSyntheticResource } from '@/lib/mcp-client'
import { getDefaultPatientId } from '@/lib/env'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId') ?? getDefaultPatientId()
    const orgShort = patientId.split('_')[1] ?? '00000000'
    const [claim, claimResponse, eob] = await Promise.all([
      mcpGetSyntheticResource('Claim', `clm_${orgShort}_01`, patientId).catch(() => null),
      mcpGetSyntheticResource('ClaimResponse', `clmr_${orgShort}_01`, patientId).catch(() => null),
      mcpGetSyntheticResource('ExplanationOfBenefit', `eob_${orgShort}_01`, patientId).catch(() => null)
    ])
    return NextResponse.json({ patientId, claim, claimResponse, eob })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to load claim resources' },
      { status: 500 }
    )
  }
}
