import { createHmac } from 'crypto';
import prisma from '../../../config/database.config';
import { AppError } from '../../../shared/errors/app-error';

/**
 * Validate PayMongo webhook signature.
 * PayMongo signs with HMAC-SHA256 using the webhook secret.
 */
export function validatePaymongoSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): void {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) throw new AppError('PayMongo webhook secret not configured', 500);
  if (!signatureHeader) throw new AppError('Missing PayMongo signature header', 400);

  // Header format: "t=<timestamp>,te=<hash>,li=<hash>"
  const parts = Object.fromEntries(signatureHeader.split(',').map((p: string) => p.split('=')));
  const timestamp = parts['t'];
  const signature = parts['te'] ?? parts['li'];

  if (!timestamp || !signature) throw new AppError('Malformed PayMongo signature', 400);

  const payload    = `${timestamp}.${rawBody}`;
  const expected   = createHmac('sha256', secret).update(payload).digest('hex');
  const isValid    = expected === signature;

  if (!isValid) throw new AppError('Invalid PayMongo webhook signature', 401);
}

/**
 * Process a PayMongo payment.paid webhook event.
 * Idempotent — safe to call multiple times for the same event.
 */
export async function processPaymentPaid(eventData: {
  id:            string;
  type:          string;
  attributes: {
    amount:        number;
    currency:      string;
    payment_method_used?: string;
    paid_at:       number;
    metadata?:     Record<string, unknown>;
  };
}): Promise<{ alreadyProcessed: boolean }> {
  const paymongoPaymentId = eventData.id;

  // Idempotency check — prevents duplicate processing if webhook is delivered twice
  const existing = await prisma.paymentTransaction.findUnique({
    where: { paymongoPaymentId },
  });
  if (existing) return { alreadyProcessed: true };

  const invoiceId: string | undefined = eventData.attributes.metadata?.invoiceId as string | undefined;
  if (!invoiceId) {
    // No invoice linked — record the transaction but don't update an invoice
    await prisma.paymentTransaction.create({
      data: {
        tenantId:          'system',
        invoiceId:         'unknown',
        amount:            eventData.attributes.amount / 100, // PayMongo amounts are in centavos
        currency:          eventData.attributes.currency,
        status:            'paid',
        paymongoPaymentId,
        paymentMethod:     eventData.attributes.payment_method_used,
        paidAt:            new Date(eventData.attributes.paid_at * 1000),
        metadata:          eventData.attributes as object,
      },
    });
    return { alreadyProcessed: false };
  }

  // Find the invoice to get tenantId
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { tenantId: true },
  });

  if (!invoice) return { alreadyProcessed: false };

  const paidAt = new Date(eventData.attributes.paid_at * 1000);

  // Use a transaction — both writes must succeed or both fail
  await prisma.$transaction([
    prisma.paymentTransaction.create({
      data: {
        tenantId:          invoice.tenantId,
        invoiceId,
        amount:            eventData.attributes.amount / 100,
        currency:          eventData.attributes.currency,
        status:            'paid',
        paymongoPaymentId,
        paymentMethod:     eventData.attributes.payment_method_used,
        paidAt,
        metadata:          eventData.attributes as object,
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data:  { paymentStatus: 'Paid', status: 'Active', paidAt },
    }),
  ]);

  return { alreadyProcessed: false };
}
