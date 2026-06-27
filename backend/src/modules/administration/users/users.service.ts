import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { revokeAllUserSessions } from '../../../core/auth/session.service';
import { NotFoundError, ConflictError, ForbiddenError } from '../../../shared/errors/http-error';
import { hashPassword } from '../../../shared/helpers/crypto';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';
import { Role } from '../../../shared/constants/roles';

const SAFE_USER_SELECT = {
  id: true, tenantId: true, firstName: true, lastName: true,
  email: true, role: true, status: true, createdAt: true, updatedAt: true,
  // passwordHash is NEVER selected
};

export async function getUsers(tenantId: string, query: Record<string, unknown>) {
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
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: SAFE_USER_SELECT }),
    prisma.user.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getUserById(id: string, tenantId: string) {
  const user = await prisma.user.findFirst({ where: { id, tenantId }, select: SAFE_USER_SELECT });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function createUser(tenantId: string, actorId: string, dto: {
  firstName: string; lastName: string; email: string; password: string; role?: string;
}) {
  // role must never be System Admin via this endpoint
  if (dto.role === Role.SYSTEM_ADMIN) {
    throw new ForbiddenError('Cannot assign System Admin role via tenant user management');
  }
  const existing = await prisma.user.findFirst({ where: { email: dto.email, tenantId } });
  if (existing) throw new ConflictError('A user with this email already exists in this tenant');

  const passwordHash = await hashPassword(dto.password);
  const user = await prisma.user.create({
    data: { tenantId, firstName: dto.firstName, lastName: dto.lastName, email: dto.email, passwordHash, role: dto.role ?? Role.SALES_REP },
    select: SAFE_USER_SELECT,
  });
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.created', entityType: 'User', entityId: user.id, after: { email: dto.email, role: user.role } });
  return user;
}

export async function updateUser(id: string, tenantId: string, actorId: string, dto: {
  firstName?: string; lastName?: string; role?: string;
}) {
  // role must never be System Admin via this endpoint
  if (dto.role === Role.SYSTEM_ADMIN) {
    throw new ForbiddenError('Cannot assign System Admin role via tenant user management');
  }
  const existing = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('User');

  const user = await prisma.user.update({ where: { id }, data: dto, select: SAFE_USER_SELECT });
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.updated', entityType: 'User', entityId: id, after: dto as Record<string, unknown> });
  return user;
}

export async function deactivateUser(id: string, tenantId: string, actorId: string) {
  const existing = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('User');
  if (id === actorId) throw new ForbiddenError('Cannot deactivate your own account');

  await prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
  // Revoke all active sessions — user loses access immediately
  await revokeAllUserSessions(id);
  await writeAuditLog({ tenantId, userId: actorId, action: 'user.deactivated', entityType: 'User', entityId: id, after: { status: 'INACTIVE' }, severity: 'WARNING' });
}
