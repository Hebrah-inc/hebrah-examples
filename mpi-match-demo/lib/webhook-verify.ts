import { createHmac, timingSafeEqual } from 'crypto'
import { getWebhookSecret } from './env'

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | null) {
  if (!signatureHeader) return false
  const expected = createHmac('sha256', getWebhookSecret()).update(rawBody).digest('hex')
  try {
    return (
      expected.length === signatureHeader.length &&
      timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signatureHeader, 'utf8'))
    )
  } catch {
    return false
  }
}
