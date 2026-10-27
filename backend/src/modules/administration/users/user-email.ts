import { CrmEmailSchema, EmployeeEmailSchema, StaffEmailSchema, EMAIL_AVAILABILITY_MESSAGES, type EmailAvailability } from '@leadcrm/shared';
import type { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import prisma from '../../../config/database.config';
import { assertExternalCustomerEmail } from '../../crm/record-validation';
import { findUserByEmail } from './users.repository';
import { AppError } from '../../../shared/errors/app-error';

export async function customerEmailAvailability(tenantId: string, email: string, db: Prisma.TransactionClient = prisma): Promise<EmailAvailability> {
  const normalized = CrmEmailSchema.parse(email);
  try { await assertExternalCustomerEmail(db, tenantId, normalized); }
  catch (error) {
    if (!(error instanceof ZodError)) throw error;
    return { available: false, reason: 'STAFF_EMAIL_NOT_ALLOWED' };
  }
  return { available: true };
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
