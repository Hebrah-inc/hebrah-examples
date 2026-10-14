import { verifyWebhookSignature as sdkVerifyWebhookSignature } from '@hebrah/sdk'
import { getWebhookSecret } from './env'

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | null): boolean {
  try {
    sdkVerifyWebhookSignature(rawBody, signatureHeader, getWebhookSecret())
    return true
  } catch {
    return false
  }
}
