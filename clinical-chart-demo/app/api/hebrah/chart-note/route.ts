import { redirect } from 'next/navigation'
import { writeChartNote, type ChartNoteType } from '@/lib/hebrah-api'

const NOTE_TYPES = new Set<ChartNoteType>([
  'progress',
  'soap',
  'admission',
  'discharge',
  'operative',
  'nursing'
])

export async function POST(request: Request) {
  const form = await request.formData()
  const patientId = String(form.get('patientId') ?? '').trim()
  const noteText = String(form.get('noteText') ?? '').trim()
  const rawType = String(form.get('noteType') ?? 'progress')
  const noteType = NOTE_TYPES.has(rawType as ChartNoteType)
    ? (rawType as ChartNoteType)
    : 'progress'

  if (!patientId || !noteText) {
    redirect(patientId ? `/chart/${encodeURIComponent(patientId)}` : '/patients')
  }

  const result = await writeChartNote(patientId, noteText, noteType)
  const wrote = encodeURIComponent(result.composition_id)
  redirect(`/chart/${encodeURIComponent(patientId)}?wrote=${wrote}`)
}
