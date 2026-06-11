import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/webhook-verify'
import { addWebhookEvent } from '@/lib/webhook-store'

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('x-while-signature')
  const eventType = request.headers.get('x-while-event') ?? 'unknown'

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

  const resource = payload.resource as Record<string, unknown> | undefined
  const stored = addWebhookEvent({
    event: eventType,
    connectionId: String(payload.connection_id ?? ''),
    environment: String(payload.environment ?? 'sandbox'),
    orgId,
    resourceType: typeof resource?.resourceType === 'string' ? resource.resourceType : undefined,
    payload
  })

  return NextResponse.json({ received: true, id: stored.id })
}
