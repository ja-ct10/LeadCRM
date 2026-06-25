import { PrismaClient } from '@prisma/client';
import { AppError } from '../shared/errors/app-error';

// ── Singleton Prisma client ───────────────────────────
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

export default prisma;

// ── Tenant-scoped Prisma extension ───────────────────
// Returns a Prisma client that automatically injects tenantId into
// all findMany / findFirst / count operations on tenant-scoped models.
// Use this in service layer instead of the raw prisma client.
export function createTenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      contact:               buildTenantScope(tenantId),
      deal:                  buildTenantScope(tenantId),
      contactDeal:           buildTenantScope(tenantId),
      dealStageHistory:      buildTenantScope(tenantId),
      task:                  buildTenantScope(tenantId),
      activity:              buildTenantScope(tenantId),
      organization:          buildTenantScope(tenantId),
      campaign:              buildTenantScope(tenantId),
      campaignContact:       buildTenantScope(tenantId),
      template:              buildTenantScope(tenantId),
      workflow:              buildTenantScope(tenantId),
      workflowTriggerRecord: buildTenantScope(tenantId),
      workflowExecutionRun:  buildTenantScope(tenantId),
      invoice:               buildTenantScope(tenantId),
      paymentTransaction:    buildTenantScope(tenantId),
      serviceOrder:          buildTenantScope(tenantId),
      asset:                 buildTenantScope(tenantId),
      inventoryItem:         buildTenantScope(tenantId),
      notification:          buildTenantScope(tenantId),
      auditLog:              buildTenantScope(tenantId),
    },
  });
}

// Intercept read operations and inject tenantId automatically
function buildTenantScope(tenantId: string) {
  return {
    async findMany({ args, query }: { args: Record<string, unknown>; query: (args: unknown) => unknown }) {
      args.where = { ...(args.where as object ?? {}), tenantId };
      return query(args);
    },
    async findFirst({ args, query }: { args: Record<string, unknown>; query: (args: unknown) => unknown }) {
      args.where = { ...(args.where as object ?? {}), tenantId };
      return query(args);
    },
    async count({ args, query }: { args: Record<string, unknown>; query: (args: unknown) => unknown }) {
      args.where = { ...(args.where as object ?? {}), tenantId };
      return query(args);
    },
  };
}

// ── Plan limit enforcement ────────────────────────────
type PlanResource = 'contacts' | 'users' | 'deals';

export async function enforcePlanLimit(
  tenantId: string,
  resource: PlanResource,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { maxContacts: true, maxUsers: true, maxDeals: true },
  });

  if (!tenant) throw new AppError('Tenant not found', 404);

  const limitMap: Record<PlanResource, number | null | undefined> = {
    contacts: tenant.maxContacts,
    users:    tenant.maxUsers,
    deals:    tenant.maxDeals,
  };

  const limit = limitMap[resource];
  if (!limit) return; // No limit set on this plan

  let count = 0;
  if (resource === 'contacts') count = await prisma.contact.count({ where: { tenantId } });
  else if (resource === 'users') count = await prisma.user.count({ where: { tenantId } });
  else if (resource === 'deals') count = await prisma.deal.count({ where: { tenantId } });

  if (count >= limit) {
    throw new AppError(
      `${resource.charAt(0).toUpperCase() + resource.slice(1)} limit reached for your current plan. Upgrade to add more.`,
      403,
    );
  }
}
