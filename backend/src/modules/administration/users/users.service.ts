import { assertNoOwnership } from './user-deactivation.service';
import { eligibleAgents } from '../../crm/leads/lead-automation.service';
import { requestPasswordReset } from '../../../core/auth/password-reset.service';
import { sortedPageIds, orderPage } from '../../../shared/helpers/sorted-page';
import { readSelfAvatar } from '../../../core/auth/profile.service';
import { replaceUserRole } from '../roles/roles.repository';
import { CreateUsersSchema, UpdateUsersSchema } from './users.dto';
import { requireEmployeeAccount } from '../../../core/auth/account-access';
import { generateTemporaryPassword } from '../../../core/auth/temporary-password';
import { sendWelcomeCredentials } from '../../../core/auth/welcome-credentials.service';
import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { revokeAllUserSessions } from '../../../core/auth/session.service';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../../shared/errors/http-error';
import { hashPassword } from '../../../shared/helpers/crypto';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';
import { Prisma } from '@prisma/client';

const SAFE_USER_SELECT = {
  id: true, tenantId: true, firstName: true, lastName: true,
  email: true, role: true, status: true, createdAt: true, updatedAt: true,
  phone: true, jobTitle: true, department: true, avatarUrl: true, lastLoginAt: true,
  // passwordHash is NEVER selected
};


export async function getAll(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;
  const where = {
    tenantId,
    ...(query.status ? { status: String(query.status) as 'ACTIVE' | 'INACTIVE' | 'PENDING' } : {}),
    ...(query.role   ? { role:   String(query.role) }   : {}),
    ...(query.search ? {
      OR: [
        { firstName: { contains: String(query.search), mode: 'insensitive' as const } },
        { lastName:  { contains: String(query.search), mode: 'insensitive' as const } },
        { email:     { contains: String(query.search), mode: 'insensitive' as const } },
      ],
    } : {}),
  };
  const ids = await sortedPageIds(query.sort === 'createdAt:desc' ? undefined : query.sort, ['firstName', 'email', 'role', 'status', 'createdAt'], skip, limit,
    () => prisma.user.findMany({ where, select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, createdAt: true } }));
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where: ids ? { ...where, id: { in: ids } } : where, skip: ids ? 0 : skip, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: SAFE_USER_SELECT }),
    prisma.user.count({ where }),
  ]);
  const assignable = new Set((await eligibleAgents(prisma, tenantId)).map(user => user.id));
  return paginate(orderPage(data, ids).map(user => ({ ...user, assignableAgent: assignable.has(user.id) })), total, { page, limit });
}

export async function getById(id: string, tenantId: string) {
  const user = await prisma.user.findFirst({ where: { id, tenantId }, select: SAFE_USER_SELECT });
  if (!user) throw new NotFoundError('User');
  return { ...user, assignableAgent: (await eligibleAgents(prisma, tenantId)).some(agent => agent.id === id) };
}

export async function getAvatar(id: string, tenantId: string, avatarId: string) {
  await getById(id, tenantId);
  return readSelfAvatar(id, tenantId, avatarId);
}

export async function create(tenantId: string, actorId: string, dto: {
  firstName: string; lastName: string; email: string; role: string; phone: string; jobTitle?: string; department?: string;
}) {
  dto = CreateUsersSchema.parse(dto);
  const role = await prisma.roleDefinition.findFirst({ where: { tenantId, name: dto.role, isArchived: false, isSystemRole: false } });
  if (!role) throw new ValidationError('Select an active custom role.');
  requireEmployeeAccount({ email: dto.email, role: dto.role });
  const existing = await prisma.user.findFirst({ where: { email: dto.email, tenantId } });
  if (existing) throw new ConflictError('A user with this email already exists in this tenant');

  const temporaryPassword = generateTemporaryPassword(dto.firstName, dto.lastName);
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await prisma.$transaction(async tx => {
    const created = await tx.user.create({
      data: {
        tenantId, firstName: dto.firstName, lastName: dto.lastName,
        email: dto.email.trim().toLowerCase(), passwordHash,
        mustChangePassword: true, onboardingCompletedAt: null, role: dto.role,
        phone: dto.phone, jobTitle: dto.jobTitle, department: dto.department,
      },
      select: SAFE_USER_SELECT,
    });
    await replaceUserRole(tx, created.id, tenantId, created.role);
    await tx.auditLog.create({ data: { tenantId, userId: actorId, action: 'user.created', entityType: 'User', entityId: created.id, changeset: { before: null, after: { email: dto.email, role: created.role } } } });
    return created;
  });
  const setupEmailSent = await sendWelcomeCredentials(user, temporaryPassword);
  return { ...user, setupEmailSent };
}

export async function update(id: string, tenantId: string, actorId: string, dto: {
  firstName?: string; lastName?: string; role?: string; status?: string; phone?: string; jobTitle?: string; department?: string;
}) {
  dto = UpdateUsersSchema.parse(dto);
  if (dto.status && !['ACTIVE', 'INACTIVE', 'PENDING'].includes(dto.status)) {
    throw new ValidationError('Invalid status value provided');
  }

  const existing = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('User');


  if (existing.role === 'Client Admin' && dto.role !== undefined) throw new ForbiddenError('Client Admin role cannot be reassigned');
  if (id === actorId && dto.status === 'INACTIVE') throw new ForbiddenError('Cannot deactivate your own account');
  const updateData: any = { ...dto };
  if (dto.status) updateData.status = dto.status as any; // Cast as enum

  const protectsLastClientAdmin = existing.role === 'Client Admin' && existing.status === 'ACTIVE' && dto.status === 'INACTIVE';
  let user;
  try {
    user = await prisma.$transaction(async tx => {
      if (dto.status === 'INACTIVE') await assertNoOwnership(tx, tenantId, id);
      if (protectsLastClientAdmin) {
        const activeAdmins = await tx.user.count({ where: { tenantId, role: 'Client Admin', status: 'ACTIVE' } });
        if (activeAdmins <= 1) throw new ConflictError('At least one active Client Admin must remain.');
      }
      if (dto.role) await replaceUserRole(tx, id, tenantId, dto.role);
      return tx.user.update({ where: { id }, data: updateData, select: SAFE_USER_SELECT });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    // A concurrent administrator deactivation can invalidate the serializable count.
    if (protectsLastClientAdmin && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ConflictError('At least one active Client Admin must remain.');
    }
    throw error;
  }
  if (dto.status === 'INACTIVE') await revokeAllUserSessions(id);
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.updated', entityType: 'User', entityId: id, before: { status: existing.status }, after: dto as Record<string, unknown> });
  return user;
}

export async function archive(id: string, tenantId: string, actorId: string) {
  const existing = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('User');
  if (existing.role === 'Client Admin') throw new ForbiddenError('Client Admin cannot be archived');
  if (id === actorId) throw new ForbiddenError('Cannot archive your own account');

  await prisma.$transaction(async tx => {
    await assertNoOwnership(tx, tenantId, id);
    await tx.user.update({ where: { id, tenantId }, data: { status: 'INACTIVE' } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await revokeAllUserSessions(id);
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.archived', entityType: 'User', entityId: id, after: { status: 'INACTIVE' }, severity: 'WARNING' });
}

export async function restore(id: string, tenantId: string, actorId: string) {
  const existing = await prisma.user.findFirst({ where: { id, tenantId, status: 'INACTIVE' } });
  if (!existing) throw new NotFoundError('User');
  const result = await prisma.user.updateMany({ where: { id, tenantId, status: 'INACTIVE' }, data: { status: 'ACTIVE' } });
  if (!result.count) throw new NotFoundError('Archived user');
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.restored', entityType: 'User', entityId: id, after: { status: 'ACTIVE' }, severity: 'INFO' });
}

export async function deleteRecord(id: string, tenantId: string, actorId: string) {
  const existing = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('User');
  if (id === actorId) throw new ForbiddenError('Cannot delete your own account');

  await prisma.user.delete({ where: { id } });
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.deleted', entityType: 'User', entityId: id, severity: 'CRITICAL' });
}

export async function bulkUpdate(ids: string[], tenantId: string, actorId: string, dto: Record<string, any>) {
  dto = UpdateUsersSchema.parse(dto);
  if (dto.status && !['ACTIVE', 'INACTIVE', 'PENDING'].includes(dto.status)) {
    throw new ValidationError('Invalid status value provided');
  }

  if (dto.status !== undefined && (ids.includes(actorId) || await prisma.user.count({ where: { id: { in: ids }, tenantId, role: 'Client Admin' } }))) throw new ForbiddenError('Cannot change your own or Client Admin status in bulk');
  if (dto.status === 'INACTIVE') throw new ConflictError('Deactivate users individually to review CRM ownership.');
  await prisma.$transaction(async tx => {
    const where = { id: { in: ids }, tenantId };
    if (dto.role) {
      const targets = await tx.user.findMany({ where, select: { id: true } });
      for (const target of targets) await replaceUserRole(tx, target.id, tenantId, dto.role);
    }
    await tx.user.updateMany({ where, data: dto });
  });
  if (dto.status === 'INACTIVE') for (const id of ids) await revokeAllUserSessions(id);
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.bulk_updated', entityType: 'User', after: { ids, updates: dto }, severity: 'WARNING' });
}

export async function bulkDelete(ids: string[], tenantId: string, actorId: string) {
  if (ids.includes(actorId)) throw new ForbiddenError('Cannot delete your own account in a bulk operation');

  await prisma.user.deleteMany({
    where: {
      id: { in: ids },
      tenantId,
    },
  });
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.bulk_deleted', entityType: 'User', after: { ids }, severity: 'CRITICAL' });
}

export async function sendPasswordReset(id: string, tenantId: string, actorId: string) {
  const user = await getById(id, tenantId);
  if (user.status !== 'ACTIVE') throw new ForbiddenError('Password recovery is unavailable for this user.');
  try { await requestPasswordReset({ email: user.email }, { userId: user.id, tenantId }); }
  catch { throw new ValidationError('Unable to send recovery email. Please try again.'); }
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.password_reset_requested_by_admin', entityType: 'User', entityId: id });
}
