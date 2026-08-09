import { PrismaClient } from '@prisma/client';
import { AppError } from '../shared/errors/app-error';

// ── Singleton raw Prisma client ───────────────────────
// This is the default export used by all repositories and services.
// It is the standard PrismaClient — full model type safety included.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;

// ── Tenant-scoped Prisma extension ───────────────────
// Returns a client that auto-injects tenantId on read operations.
// Use in service layer when you want automatic tenant scoping.
// Note: $extends returns an extended client — types differ from raw PrismaClient.
export function createTenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
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
      },
    },
  });
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

  let limit: number | null | undefined;
  if (resource === 'contacts') limit = tenant.maxContacts;
  else if (resource === 'users') limit = tenant.maxUsers;
  else if (resource === 'deals') limit = tenant.maxDeals;

  if (!limit) return; // No limit set — allow

  let count = 0;
  if (resource === 'contacts') count = await prisma.lead.count({ where: { tenantId } });
  else if (resource === 'users') count = await prisma.user.count({ where: { tenantId } });
  else if (resource === 'deals') count = await prisma.deal.count({ where: { tenantId } });

  if (count >= limit) {
    const label = resource.charAt(0).toUpperCase() + resource.slice(1);
    throw new AppError(
      `${label} limit reached for your current plan. Upgrade to add more.`,
      403,
    );
  }
}
