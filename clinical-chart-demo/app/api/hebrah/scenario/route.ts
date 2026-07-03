import { redirect } from 'next/navigation'
import { runScenario } from '@/lib/hebrah-api'

export async function POST(request: Request) {
  const form = await request.formData()
  const patientId = String(form.get('patientId') ?? '')
  const scenarioId = String(form.get('scenarioId') ?? 'clinical_problem_lifecycle')
  if (patientId) {
    await runScenario(scenarioId, patientId)
  }
  redirect('/events')
}
