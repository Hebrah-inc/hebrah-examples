import { redirect } from 'next/navigation'
import { injectHl7 } from '@/lib/hebrah-api'

export async function POST(request: Request) {
  const form = await request.formData()
  const patientId = String(form.get('patientId') ?? '')
  const templateId = String(form.get('templateId') ?? 'oru_r01_problem')
  if (patientId) {
    await injectHl7(templateId, patientId)
  }
  redirect('/events')
}
