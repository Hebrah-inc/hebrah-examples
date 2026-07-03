import ClinicalTriggers from './ClinicalTriggers'
import { defaultPatientId } from '@/lib/connection-patient'

type Props = {
  searchParams: Promise<{ patientId?: string }>
}

export default async function ClinicalPage({ searchParams }: Props) {
  const params = await searchParams
  const patientId = params.patientId?.trim() || defaultPatientId()

  return <ClinicalTriggers defaultPatientId={patientId} />
}
