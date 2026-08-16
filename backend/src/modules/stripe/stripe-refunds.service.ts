import { getStripe } from '../../config/stripe.config';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { writeAuditLog } from '../../core/audit/audit.service';

export interface InitiateRefundInput {
  paymentTransactionId: string;
  amountCents?:         number;   // omit for full refund
  reason?:              'duplicate' | 'fraudulent' | 'requested_by_customer';
  initiatedByUserId:    string;
}

export interface RefundResult {
  refundId:     string;   // re_xxx
  amount:       number;   // in dollars (not cents)
  status:       string;
  isFullRefund: boolean;
}

/**
 * Initiate a refund via Stripe for a PaymentTransaction.
 *
 * Rules:
 * - Transaction must have a stripePaymentIntentId.
 * - Cannot refund more than the original amount.
 * - Cannot refund an already-fully-refunded transaction.
 * - DB is updated ONLY after Stripe confirms — never before.
 */
export async function initiateRefund(input: InitiateRefundInput): Promise<RefundResult> {
  const stripe = getStripe();
  const { paymentTransactionId, amountCents, reason, initiatedByUserId } = input;

  const txn = await prisma.paymentTransaction.findUnique({
    where:   { id: paymentTransactionId },
    include: { invoice: { select: { tenantId: true } } },
  });

  if (!txn) throw new AppError('Payment transaction not found', 404);

  if (!txn.stripePaymentIntentId) {
    throw new AppError('This transaction was not processed via Stripe and cannot be refunded here.', 400);
  }

  if (txn.status === 'refunded') {
    throw new AppError('This transaction has already been fully refunded.', 400);
  }

  const originalAmountCents = Math.round(txn.amount * 100);
  const alreadyRefundedCents = Math.round((txn.refundedAmount ?? 0) * 100);
  const remainingCents = originalAmountCents - alreadyRefundedCents;

  if (remainingCents <= 0) {
    throw new AppError('No refundable amount remaining on this transaction.', 400);
  }

  const refundCents = amountCents ?? remainingCents;

  if (refundCents > remainingCents) {
    throw new AppError(
      `Refund amount ($${(refundCents / 100).toFixed(2)}) exceeds remaining refundable amount ($${(remainingCents / 100).toFixed(2)}).`,
      400,
    );
  }

  // Call Stripe — only update DB after this succeeds
  const refund = await stripe.refunds.create({
    payment_intent: txn.stripePaymentIntentId,
    amount:         refundCents,
    reason:         reason ?? 'requested_by_customer',
    metadata: {
      transactionId: txn.id,
      tenantId:      txn.tenantId,
      initiatedBy:   initiatedByUserId,
    },
  });

  if (refund.status === 'failed') {
    throw new AppError(`Stripe refund failed: ${refund.failure_reason ?? 'unknown reason'}`, 400);
  }

  const newRefundedAmount = alreadyRefundedCents + refundCents;
  const isFullRefund = newRefundedAmount >= originalAmountCents;

  // Update DB to reflect the refund
  await prisma.paymentTransaction.update({
    where: { id: txn.id },
    data: {
      stripeRefundId:  refund.id,
      refundedAmount:  newRefundedAmount / 100,
      refundedAt:      new Date(),
      status:          isFullRefund ? 'refunded' : 'partially_refunded',
    },
  });

  await writeAuditLog({
    tenantId:   txn.tenantId,
    userId:     initiatedByUserId,
    action:     isFullRefund ? 'stripe.refund.full' : 'stripe.refund.partial',
    entityType: 'PaymentTransaction',
    entityId:   txn.id,
    metadata: {
      stripeRefundId:  refund.id,
      amountRefunded:  refundCents / 100,
      stripePaymentIntentId: txn.stripePaymentIntentId,
    },
    severity: 'WARNING',
  });

  return {
    refundId:     refund.id,
    amount:       refundCents / 100,
    status:       refund.status ?? 'succeeded',
    isFullRefund,
  };
}

/**
 * List refundable transactions (paid Stripe transactions with remaining amount).
 */
export async function listRefundableTransactions(params: {
  page:    number;
  limit:   number;
  search?: string;
}): Promise<{ data: unknown[]; total: number }> {
  const { page, limit, search } = params;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {
    stripePaymentIntentId: { not: null },
    status: { in: ['paid', 'partially_refunded'] },
  };

  if (search) {
    where.invoice = {
      OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { tenant:        { name: { contains: search, mode: 'insensitive' } } },
      ],
    };
  }

  const [data, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      skip:    offset,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.paymentTransaction.count({ where }),
  ]);

  return { data, total };
}
