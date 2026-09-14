// Webhook signature verification — thin wrapper over the SDK's
// `verifyWebhookSignature` (HMAC-SHA256, timing-safe compare).
// The demo keeps its boolean contract; the SDK returns the parsed
// envelope or throws, so we translate.

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