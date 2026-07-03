import { NextResponse } from 'next/server'
import { evaluateRelayResponse, getRelayMode } from '@/lib/relay-mode'
import { verifyWebhookSignature } from '@/lib/webhook-verify'
import { addWebhookEvent } from '@/lib/webhook-store'

export async function POST(request: Request) {
  const mode = getRelayMode()
  if (mode.mode === 'timeout') {
    await new Promise(resolve => setTimeout(resolve, 120_000))
  }
  if (mode.mode === 'slow') {
    await new Promise(resolve => setTimeout(resolve, mode.slowMs))
  }

  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('x-hebrah-signature')
    ?? request.headers.get('x-while-signature')
  const eventType = request.headers.get('x-hebrah-event')
    ?? request.headers.get('x-while-event')
    ?? 'unknown'
  const deliveryId = request.headers.get('x-hebrah-delivery-id') ?? undefined

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  const orgId = typeof payload.org_id === 'string' ? payload.org_id : null
  if (!orgId) {
    return NextResponse.json({ message: 'Missing org_id in payload' }, { status: 400 })
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ message: 'Invalid webhook signature' }, { status: 401 })
  }

  const verdict = evaluateRelayResponse(mode)
  if (!verdict.ok) {
    addWebhookEvent({
      event: eventType,
      connectionId: String(payload.connection_id ?? ''),
      environment: String(payload.environment ?? 'sandbox'),
      orgId,
      deliveryId,
      statusCode: verdict.status,
      payload
    })
    return NextResponse.json({ message: verdict.message }, { status: verdict.status })
  }

  const stored = addWebhookEvent({
    event: eventType,
    connectionId: String(payload.connection_id ?? ''),
    environment: String(payload.environment ?? 'sandbox'),
    orgId,
    deliveryId,
    statusCode: 200,
    payload
  })

  return NextResponse.json({ received: true, id: stored.id, mode: mode.mode })
}
