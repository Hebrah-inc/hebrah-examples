import { verifyWebhookSignature as sdkVerifyWebhookSignature } from '@hebrah/sdk'
import { getWebhookSecret } from './env'

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | null) {
  return sdkVerifyWebhookSignature(rawBody, signatureHeader, getWebhookSecret())
}
