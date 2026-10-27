import { CrmEmailSchema, EmployeeEmailSchema, StaffEmailSchema, EMAIL_AVAILABILITY_MESSAGES, type EmailAvailability } from '@leadcrm/shared';
import type { Prisma } from '@prisma/client';
import { findUserByEmail } from './users.repository';
import { AppError } from '../../../shared/errors/app-error';

export async function customerEmailAvailability(tenantId: string, email: string, db?: Prisma.TransactionClient): Promise<EmailAvailability> {
  const existing = await findUserByEmail(CrmEmailSchema.parse(email), tenantId, db);
  return existing ? { available: false, reason: 'STAFF_EMAIL_NOT_ALLOWED' } : { available: true };
}

export async function userEmailAvailability(tenantId: string, email: string, actorRole: string): Promise<EmailAvailability> {
  const normalized = StaffEmailSchema.parse(email);
  if (actorRole !== 'Client Admin' && !EmployeeEmailSchema.safeParse(normalized).success) {
    return { available: false, reason: 'EXTERNAL_STAFF_EMAIL_NOT_ALLOWED' };
  }
  return await findUserByEmail(normalized, tenantId) ? { available: false, reason: 'EMAIL_IN_USE' } : { available: true };
}

export async function assertCustomerEmail(tenantId: string, email: string, db: Prisma.TransactionClient) {
  const result = await customerEmailAvailability(tenantId, email, db);
  if (!result.available) throw new AppError(EMAIL_AVAILABILITY_MESSAGES[result.reason], 400, result.reason);
}
