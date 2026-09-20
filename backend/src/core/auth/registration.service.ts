import { requireEmployeeAccount } from './account-access';
import { createHash } from 'crypto';
import type { RegisterInput } from '@leadcrm/shared';
import type { Prisma } from '@prisma/client';
import { hashPassword } from '../../shared/helpers/crypto';
import { AppError } from '../../shared/errors/app-error';
import { ConflictError } from '../../shared/errors/http-error';
import { authTransaction } from './auth-transaction';

/** Only administrator-issued, single-use invitations can create an account. */
export async function acceptInvitation(dto: RegisterInput) {
  const email = dto.email.trim().toLowerCase();
  if (!dto.invitationToken) throw new AppError('Accounts are provisioned by your administrator.', 403);
  requireEmployeeAccount({ email, role: '' });
  const passwordHash = await hashPassword(dto.password);
  const result = await authTransaction(async tx => {
    const existing = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictError('A user with this email already exists');
    const user = await joinInvitation(tx, dto, email, passwordHash);
    return { user };
  });
  const emailSent = false;
  const { id, role, tenantId } = result.user;
  return { id, email, role, tenantId, emailSent };
}



async function joinInvitation(
  tx: Prisma.TransactionClient,
  dto: RegisterInput,
  email: string,
  passwordHash: string,
) {
  const tokenHash = createHash('sha256').update(dto.invitationToken!).digest('hex');
  const invitation = await tx.tenantInvitation.findFirst({
    where: { tokenHash },
    include: { role: true },
  });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt ||
      invitation.expiresAt <= new Date() || invitation.email.toLowerCase() !== email) {
    throw new AppError('Invalid or expired invitation. Request a new invitation.', 400);
  }
  if (!invitation.role || invitation.role.tenantId !== invitation.tenantId) {
    throw new AppError('The invitation role is no longer available.', 400);
  }
  if (invitation.role.isArchived || invitation.role.isSystemRole || ['guest', 'systemadmin', 'clientadmin'].includes(invitation.role.name.toLowerCase().replace(/[\s_-]/g, ''))) throw new AppError('Invalid invitation role.', 403);
  const user = await tx.user.create({
    data: {
      tenantId: invitation.tenantId,
      email, passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: invitation.role.name,
      status: 'ACTIVE',
      emailVerified: new Date(),
      mustChangePassword: false,
    },
  });
  await tx.userRole.create({
    data: {
      userId: user.id,
      tenantId: invitation.tenantId,
      roleId: invitation.role.id,
    },
  });
  await tx.tenantInvitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });
  return user;
}
