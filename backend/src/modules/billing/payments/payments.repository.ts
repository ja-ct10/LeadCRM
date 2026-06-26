import prisma from '../../../config/database.config';

export async function findTransactionsByInvoice(invoiceId: string, tenantId: string) {
  return prisma.paymentTransaction.findMany({
    where: { invoiceId, tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findTransactionByPaymongoId(paymongoPaymentId: string) {
  return prisma.paymentTransaction.findUnique({ where: { paymongoPaymentId } });
}
