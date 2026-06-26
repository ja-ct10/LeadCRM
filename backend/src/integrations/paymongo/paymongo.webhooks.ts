import { createHmac } from 'crypto';
import { PayMongoWebhookPayload } from './paymongo.types';

/**
 * Verifies the PayMongo webhook signature before processing any payload.
 * Never process a webhook payload without verifying the signature first.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('PAYMONGO_WEBHOOK_SECRET is not configured');
  }

  const [, signatureValue] = signature.split('=');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signatureValue;
}

export function handleWebhookEvent(payload: PayMongoWebhookPayload): void {
  const eventType = payload.data?.attributes?.type;

  switch (eventType) {
    case 'payment.paid':
      // TODO: activate tenant subscription, create invoice record
      console.log('[PayMongo] payment.paid received');
      break;
    case 'payment.failed':
      // TODO: mark invoice as failed, notify tenant
      console.log('[PayMongo] payment.failed received');
      break;
    default:
      console.log(`[PayMongo] Unhandled event type: ${eventType}`);
  }
}
