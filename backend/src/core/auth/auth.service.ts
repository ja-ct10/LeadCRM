import { requireEmployeeAccount } from './account-access';
import prisma from '../../config/database.config';
import { comparePassword } from '../../shared/helpers/crypto';
import { AppError } from '../../shared/errors/app-error';
import { createAuthSessionToken, type SessionContext } from './auth-session';
import { authTenantSelect, buildAuthUserResponse } from './auth-user';
export { buildAuthUserResponse } from './auth-user';
export type { AuthUserSource, AuthUserResponse } from './auth-user';
export { acceptInvitation } from './registration.service';
export { sendRegistrationOtp, verifyRegistrationOtp } from './verification.service';
export { requestPasswordReset, resetPasswordWithToken } from './password-reset.service';

export interface LoginDto { email: string; password: string; }
export type LoginContext = SessionContext;

export async function loginUser(dto: LoginDto, ctx: LoginContext = {}) {
  // Normalise the incoming email so casing differences never cause a lookup
  // failure (e.g. "Admin@Gmail.com" → "admin@gmail.com").
  const normalisedEmail = dto.email.toLowerCase().trim();

  // Preserve deterministic password login for legacy tenant-scoped email duplicates.
  const candidates = await prisma.user.findMany({
    where: { email: { equals: normalisedEmail, mode: 'insensitive' } },
    include: { tenant: { select: authTenantSelect } },
    orderBy: { createdAt: 'asc' },
  });

  // Generic message — do not reveal whether the email exists.
  if (candidates.length === 0) throw new AppError('Invalid email or password', 401);

  // Find the first candidate whose password hash matches.
  let user: typeof candidates[0] | null = null;
  for (const candidate of candidates) {
    if (!candidate.passwordHash) continue;
    const matches = await comparePassword(dto.password, candidate.passwordHash);
    if (matches) {
      user = candidate;
      break;
    }
  }

  // No candidate matched the password — use a generic 401.
  if (!user) throw new AppError('Invalid email or password', 401);

  requireEmployeeAccount(user);
  if (user.role !== 'System Admin' && ['SUSPENDED', 'REJECTED'].includes(user.tenant?.status ?? '')) {
    throw new AppError('Workspace access is suspended.', 403);
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is inactive. Contact your administrator.', 403);
  }

  const token = await createAuthSessionToken(user, ctx);

  return {
    token,
    // Align the login response contract with GET /auth/me by returning the
    // same canonical, flattened shape via the shared helper.
    user: buildAuthUserResponse(user),
  };
}

