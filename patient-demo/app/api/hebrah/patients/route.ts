import { NextResponse } from 'next/server'
import { fetchPatient, fetchPatientList } from '@/lib/hebrah-api'
import { HebrahApiError } from '@/lib/hebrah-api'
import { parsePatient, patientDisplayName, patientMrn } from '@/lib/fhir'

export async function GET() {
  try {
    const list = await fetchPatientList()
    const ids = list.patients.slice(0, 5)
    const patients = await Promise.all(
      ids.map(async ({ id }) => {
        const raw = await fetchPatient(id)
        const patient = parsePatient(raw)
        return {
          id,
          name: patientDisplayName(patient),
          gender: patient.gender ?? '—',
          birthDate: patient.birthDate ?? '—',
          mrn: patientMrn(patient)
        }
      })
    )
    return NextResponse.json({ patients })
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
