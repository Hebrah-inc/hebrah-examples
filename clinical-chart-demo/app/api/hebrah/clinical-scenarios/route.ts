import { NextResponse } from 'next/server'
import { filterClinicalScenarios } from '@/lib/clinical-scenarios'
import { fetchSandboxDomains } from '@/lib/hebrah-api'

export async function GET() {
  try {
    const domains = await fetchSandboxDomains()
    return NextResponse.json({ scenarios: filterClinicalScenarios(domains) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load scenarios'
    return NextResponse.json({ message }, { status: 503 })
  }
}
