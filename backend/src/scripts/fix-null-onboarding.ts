/**
 * Inventory only by default. Never infer completion from a name, role, or null timestamp.
 * Apply only a reviewed manifest: npm --prefix backend run fix:onboarding -- --apply path.json
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { getOnboardingState } from '@leadcrm/shared';
import prisma from '../config/database.config';
import { authTransaction } from '../core/auth/auth-transaction';
import { seedDefaultPipeline } from '../database/seeders/pipeline.seed';
import { seedSystemRoles } from '../database/seeders/roles.seed';

const ChangeSchema = z.object({
  tenantId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  expectedOwnerUserId: z.string().uuid().nullable(),
  assignOwnerUserId: z.string().uuid().optional(),
  repairDefaults: z.boolean().default(false),
  expectedStep: z.number().int(),
  expectedCompletedAt: z.string().datetime().nullable(),
  resumeStep: z.union([z.literal(0), z.literal(2)]),
  demoteGoogleFounder: z.boolean().default(false),
  reason: z.string().min(10),
}).strict();
const ManifestSchema = z.object({ changes: z.array(ChangeSchema).min(1) }).strict();

async function inventory() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true, updatedAt: true, ownerUserId: true, status: true,
      subscriptionStatus: true, plan: true, industry: true, companySize: true,
      onboardingStep: true, onboardingCompletedAt: true,
      users: {
        select: {
          id: true, role: true,
          oauthAccounts: { select: { provider: true } },
          _count: { select: { userRoles: true } },
        },
      },
      _count: { select: { pipelines: true, roleDefinitions: true, subscriptions: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const inventoryRows = tenants.map(tenant => {
    const reasons: string[] = [];
    const state = getOnboardingState(tenant);
    if (state !== 'completed') reasons.push(state === 'invalid' ? 'Invalid state' : 'Incomplete setup');
    const owner = tenant.users.find(user => user.id === tenant.ownerUserId);
    if (!owner) reasons.push('Missing or inconsistent owner');
    if (!tenant._count.pipelines) reasons.push('Missing pipeline');
    if (!tenant._count.roleDefinitions || tenant.users.some(user => !user._count.userRoles)) {
      reasons.push('Missing roles or assignments');
    }
    if (owner?.role === 'Client Admin' &&
        owner.oauthAccounts.some(account => account.provider === 'google') &&
        tenant.status === 'SANDBOX' && tenant.subscriptionStatus === 'NONE' &&
        !tenant.plan && !tenant._count.subscriptions) {
      reasons.push('Review Google founder promotion history; do not infer an erroneous role');
    }
    return { ...tenant, reasons };
  });
  console.log(JSON.stringify({
    total: inventoryRows.length,
    needsReview: inventoryRows.filter(tenant => tenant.reasons.length).length,
    tenants: inventoryRows,
  }, null, 2));
  console.log('Inventory only. No changes made. Review affected tenant IDs before preparing a manifest.');
}

async function applyChange(change: z.infer<typeof ChangeSchema>) {
  await authTransaction(async tx => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: change.tenantId } });
    if (tenant.updatedAt.toISOString() !== change.expectedUpdatedAt ||
        tenant.ownerUserId !== change.expectedOwnerUserId ||
        tenant.onboardingStep !== change.expectedStep ||
        (tenant.onboardingCompletedAt?.toISOString() ?? null) !== change.expectedCompletedAt) {
      throw new Error(`Tenant ${tenant.id} changed after review. Inventory and review it again.`);
    }
    if (change.assignOwnerUserId && tenant.ownerUserId) {
      throw new Error('An established workspace owner cannot be replaced by this repair.');
    }
    const ownerId = change.assignOwnerUserId ?? change.expectedOwnerUserId;
    if (!ownerId) throw new Error('Review and explicitly assign the missing owner.');
    const owner = await tx.user.findFirst({
      where: { id: ownerId, tenantId: tenant.id },
    });
    if (!owner || owner.role === 'System Admin') throw new Error('Invalid customer workspace owner.');

    if (change.demoteGoogleFounder) {
      const google = await tx.oAuthAccount.findFirst({
        where: { userId: owner.id, tenantId: tenant.id, provider: 'google' },
      });
      const hasSubscriptionHistory = await tx.subscription.count({ where: { tenantId: tenant.id } });
      if (!google || hasSubscriptionHistory > 0 || owner.passwordHash ||
          owner.role !== 'Client Admin' || tenant.status !== 'SANDBOX' ||
          tenant.subscriptionStatus !== 'NONE' || tenant.plan !== null) {
        throw new Error('Demotion is restricted to reviewed unpaid Google sandbox founders.');
      }
      const assignments = await tx.userRole.findMany({
        where: { userId: owner.id, tenantId: tenant.id },
        include: { role: true },
      });
      if (assignments.some(assignment => !['Client Admin', 'Guest'].includes(assignment.role.name))) {
        throw new Error('Custom founder role assignments require a separate reviewed repair.');
      }
      await seedSystemRoles(tenant.id, tx);
      const guest = await tx.roleDefinition.findUniqueOrThrow({
        where: { tenantId_name: { tenantId: tenant.id, name: 'Guest' } },
      });
      await tx.userRole.deleteMany({ where: { userId: owner.id, tenantId: tenant.id } });
      await tx.userRole.create({
        data: { userId: owner.id, tenantId: tenant.id, roleId: guest.id },
      });
      await tx.user.update({ where: { id: owner.id }, data: { role: 'Guest' } });
      await tx.session.deleteMany({ where: { userId: owner.id, tenantId: tenant.id } });
    }
    if (change.repairDefaults) {
      await seedSystemRoles(tenant.id, tx);
      await seedDefaultPipeline(tenant.id, tx);
      const role = await tx.roleDefinition.findUniqueOrThrow({
        where: { tenantId_name: { tenantId: tenant.id, name: change.demoteGoogleFounder ? 'Guest' : owner.role } },
      });
      await tx.userRole.upsert({
        where: { userId_roleId_tenantId: { userId: owner.id, tenantId: tenant.id, roleId: role.id } },
        create: { userId: owner.id, tenantId: tenant.id, roleId: role.id }, update: {},
      });
    }
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { onboardingStep: change.resumeStep, onboardingCompletedAt: null, ownerUserId: owner.id },
    });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id, userId: owner.id, entityType: 'Tenant', entityId: tenant.id,
        action: 'ONBOARDING_REPAIRED',
        metadata: {
          reason: change.reason, previousStep: change.expectedStep,
          previousOwnerUserId: tenant.ownerUserId, previousRole: owner.role,
          ownerUserId: owner.id, repairedDefaults: change.repairDefaults,
          previousCompletedAt: change.expectedCompletedAt,
          resumeStep: change.resumeStep, demoted: change.demoteGoogleFounder,
        },
      },
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--dry-run')) return inventory();
  if (args.length !== 2 || args[0] !== '--apply') {
    throw new Error('Use --dry-run, or --apply <reviewed-manifest.json>.');
  }
  const manifest = ManifestSchema.parse(JSON.parse(readFileSync(args[1], 'utf8')));
  if (new Set(manifest.changes.map(change => change.tenantId)).size !== manifest.changes.length) {
    throw new Error('Each tenant may appear only once in the repair manifest.');
  }
  for (const change of manifest.changes) {
    await applyChange(change);
    console.log(`Repaired reviewed tenant ${change.tenantId}.`);
  }
}
main().catch(error => {
  console.error('[onboarding-repair]', error instanceof Error ? error.message : 'Repair failed');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
