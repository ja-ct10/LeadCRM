import { AppError } from '../../shared/errors/app-error';
import { EmployeeEmailSchema, StaffEmailSchema } from '@leadcrm/shared';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database.config';
import { z } from 'zod';

function matchesExactGmail(email: string, allowlist: string | undefined): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.includes('*') || !normalizedEmail.endsWith('@gmail.com') || !z.string().email().safeParse(normalizedEmail).success) return false;

  return (allowlist ?? '')
    .split(',')
    .some(allowedEmail => allowedEmail.trim().toLowerCase() === normalizedEmail);
}

export function isAllowlistedDevelopmentGmail(email: string): boolean {
  return ['development', 'test'].includes(process.env.NODE_ENV ?? '') &&
    process.env.LEADCRM_TEST_AUTH_ENABLED === 'true' &&
    matchesExactGmail(email, process.env.LEADCRM_TEST_EMAIL_ALLOWLIST);
}

/** Explicit production policy; development flags never enable production access. */
export function isAllowlistedProductionGmail(email: string): boolean {
  return process.env.NODE_ENV === 'production' &&
    process.env.LEADCRM_PRODUCTION_AUTH_ENABLED === 'true' &&
    matchesExactGmail(email, process.env.LEADCRM_PRODUCTION_EMAIL_ALLOWLIST);
}

export function requireStaffIdentity(user: { role: string; email: string }) {
  // Historical accounts remain in storage, but can never establish or reuse a session.
  if (user.role.trim().toLowerCase() === 'guest') {
    throw new AppError('This account role has been retired. Contact your administrator.', 403, 'ROLE_RETIRED');
  }
  if (!StaffEmailSchema.safeParse(user.email).success) {
    throw new AppError('A valid registered staff email is required.', 403, 'EMPLOYEE_ACCOUNT_REQUIRED');
  }
}

type StaffIdentity = { id?: string; userId?: string; tenantId?: string; role: string; email: string };

/** Approval is bound to the persisted user, tenant and exact registered address. */
export async function requireEmployeeAccount(user: StaffIdentity, db: Prisma.TransactionClient = prisma) {
  requireStaffIdentity(user);
  if (EmployeeEmailSchema.safeParse(user.email).success || isAllowlistedDevelopmentGmail(user.email)) return;
  const id = user.id ?? user.userId;
  const email = StaffEmailSchema.parse(user.email);
  if (id && user.tenantId) {
    const approval = await db.auditLog.findFirst({
      where: { tenantId: user.tenantId, entityType: 'User', entityId: id, OR: [
        { action: 'user.staff_approved', AND: [
          { metadata: { path: ['email'], equals: email } },
          { metadata: { path: ['approvedByRole'], equals: 'Client Admin' } },
        ] },
        // Existing CLI approvals remain valid without their old deployment allowlist.
        { action: { in: ['user.production_provisioned', 'user.production_credentials_reissued'] },
          changeset: { path: ['after', 'email'], equals: email } },
      ] }, select: { id: true },
    });
    if (approval) return;
  }
  throw new AppError('Ask your Client Administrator to provision your registered staff account.', 403, 'EMPLOYEE_ACCOUNT_REQUIRED');
}
