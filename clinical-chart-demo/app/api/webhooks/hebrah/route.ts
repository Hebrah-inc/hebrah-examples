import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/webhook-verify'
import { addWebhookEvent } from '@/lib/webhook-store'

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('x-hebrah-signature')
  const eventType = request.headers.get('x-hebrah-event') ?? 'unknown'

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ message: 'Invalid webhook signature' }, { status: 401 })
  }

  const resource = payload.resource as Record<string, unknown> | undefined
  const patientId = typeof payload.patient_id === 'string'
    ? payload.patient_id
    : typeof resource?.subject === 'object' && resource.subject !== null
      && typeof (resource.subject as Record<string, unknown>).reference === 'string'
      ? String((resource.subject as Record<string, unknown>).reference).replace(/^Patient\//, '')
      : undefined
  const stored = addWebhookEvent({
    event: eventType,
    connectionId: String(payload.connection_id ?? ''),
    environment: String(payload.environment ?? 'sandbox'),
    orgId: String(payload.org_id ?? ''),
    resourceType: typeof resource?.resourceType === 'string' ? resource.resourceType : undefined,
    patientId,
    payload
  })

  return NextResponse.json({ received: true, id: stored.id })
}
