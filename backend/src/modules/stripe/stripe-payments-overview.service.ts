import prisma from '../../config/database.config';
import { stripeDashboardUrl } from '../../config/stripe.config';

export interface PaymentMetrics {
  totalRevenue:         number;
  revenueThisMonth:     number;
  revenueLastMonth:     number;
  totalTransactions:    number;
  successfulPayments:   number;
  pendingPayments:      number;
  failedPayments:       number;
  refundedPayments:     number;
  totalRefundedAmount:  number;
  revenueByPlan:        Array<{ plan: string; revenue: number; count: number }>;
  revenueByTenant:      Array<{ tenantId: string; tenantName: string; revenue: number }>;
  recentTransactions:   unknown[];
}

/**
 * Aggregate payment metrics across all tenants for the System Admin dashboard.
 * Reads from the application DB — no Stripe API call needed for dashboard stats.
 */
export async function getPaymentMetrics(): Promise<PaymentMetrics> {
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    allTxns,
    thisMonthTxns,
    lastMonthTxns,
    revenueByPlanRaw,
    revenueByTenantRaw,
    recentTxns,
  ] = await Promise.all([
    // All-time stats
    prisma.paymentTransaction.groupBy({
      by:     ['status'],
      _count: { _all: true },
      _sum:   { amount: true, refundedAmount: true },
    }),

    // This month paid
    prisma.paymentTransaction.aggregate({
      where:  { status: 'paid', paidAt: { gte: monthStart } },
      _sum:   { amount: true },
    }),

    // Last month paid
    prisma.paymentTransaction.aggregate({
      where: {
        status: 'paid',
        paidAt: { gte: lastMonthStart, lt: monthStart },
      },
      _sum:  { amount: true },
    }),

    // Revenue by plan (via invoice → subscription → plan)
    prisma.paymentTransaction.findMany({
      where:   { status: 'paid' },
      include: {
        invoice: {
          select: {
            plan: true,
            subscription: {
              select: { plan: { select: { name: true } } },
            },
          },
        },
      },
    }),

    // Revenue by tenant (top 10)
    prisma.paymentTransaction.groupBy({
      by:       ['tenantId'],
      where:    { status: 'paid' },
      _sum:     { amount: true },
      orderBy:  { _sum: { amount: 'desc' } },
      take:     10,
    }),

    // Recent 10 transactions
    prisma.paymentTransaction.findMany({
      take:    10,
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
  ]);

  // Build status map
  const statusMap: Record<string, { count: number; sum: number }> = {};
  for (const row of allTxns) {
    statusMap[row.status] = {
      count: row._count._all,
      sum:   row._sum.amount ?? 0,
    };
  }

  // Plan revenue aggregation
  const planMap: Record<string, { revenue: number; count: number }> = {};
  for (const txn of revenueByPlanRaw) {
    const planName =
      txn.invoice.subscription?.plan?.name ??
      txn.invoice.plan ??
      'Unknown';
    if (!planMap[planName]) planMap[planName] = { revenue: 0, count: 0 };
    planMap[planName].revenue += txn.amount;
    planMap[planName].count   += 1;
  }

  // Tenant name lookup for top revenue tenants
  const tenantIds = revenueByTenantRaw.map((r) => r.tenantId);
  const tenants   = await prisma.tenant.findMany({
    where:  { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  const tenantNameMap = Object.fromEntries(tenants.map((t) => [t.id, t.name]));

  // Add Stripe Dashboard links to recent transactions
  const recentWithLinks = recentTxns.map((txn) => ({
    ...txn,
    stripeDashboardUrl: txn.stripePaymentIntentId
      ? stripeDashboardUrl(`/payments/${txn.stripePaymentIntentId}`)
      : null,
  }));

  return {
    totalRevenue:         statusMap['paid']?.sum ?? 0,
    revenueThisMonth:     thisMonthTxns._sum.amount ?? 0,
    revenueLastMonth:     lastMonthTxns._sum.amount ?? 0,
    totalTransactions:    Object.values(statusMap).reduce((a, b) => a + b.count, 0),
    successfulPayments:   statusMap['paid']?.count ?? 0,
    pendingPayments:      statusMap['pending']?.count ?? 0,
    failedPayments:       statusMap['failed']?.count ?? 0,
    refundedPayments:     (statusMap['refunded']?.count ?? 0) + (statusMap['partially_refunded']?.count ?? 0),
    totalRefundedAmount:  allTxns.reduce((acc, r) => acc + (r._sum.refundedAmount ?? 0), 0),
    revenueByPlan:        Object.entries(planMap).map(([plan, v]) => ({ plan, ...v })),
    revenueByTenant:      revenueByTenantRaw.map((r) => ({
      tenantId:   r.tenantId,
      tenantName: tenantNameMap[r.tenantId] ?? 'Unknown',
      revenue:    r._sum.amount ?? 0,
    })),
    recentTransactions:   recentWithLinks,
  };
}

/**
 * List all payment transactions for System Admin (all tenants).
 */
export async function listAllPayments(params: {
  page:     number;
  limit:    number;
  status?:  string;
  search?:  string;
  tenantId?: string;
}): Promise<{ data: unknown[]; total: number }> {
  const { page, limit, status, search, tenantId } = params;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status)   where.status   = status;
  if (tenantId) where.tenantId = tenantId;

  if (search) {
    where.OR = [
      { stripePaymentIntentId: { contains: search, mode: 'insensitive' } },
      { invoice: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
      { invoice: { tenant: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [txns, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      skip:    offset,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            plan:          true,
            tenant: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.paymentTransaction.count({ where }),
  ]);

  // Attach Stripe Dashboard deep-links
  const data = txns.map((txn) => ({
    ...txn,
    stripeDashboardUrl: txn.stripePaymentIntentId
      ? stripeDashboardUrl(`/payments/${txn.stripePaymentIntentId}`)
      : null,
  }));

  return { data, total };
}
