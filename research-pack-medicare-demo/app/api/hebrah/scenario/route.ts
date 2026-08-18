import { NextResponse } from 'next/server'
import { fetchCatalog, HebrahApiError, runScenario } from '@/lib/hebrah-api'

export async function POST() {
  try {
    const catalog = await fetchCatalog()
    const patientId = catalog.sample_patient_ids?.[0]
    if (!patientId) {
      return NextResponse.json({ error: 'No sample patient IDs in catalog' }, { status: 400 })
    }
    const result = await runScenario('medicare_claim_paid_workflow', patientId)
    return NextResponse.json({ patientId, result })
  } catch (error) {
    if (error instanceof HebrahApiError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
