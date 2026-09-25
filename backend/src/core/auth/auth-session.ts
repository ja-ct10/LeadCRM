import { signToken } from './jwt.service';
import { createSession } from './session.service';
import { readAuthUser } from './auth-user';
import { requireEmployeeAccount } from './account-access';
import prisma from '../../config/database.config';
import type { Prisma } from '@prisma/client';

export const AUTH_COOKIE_NAME = 'leadcrm_token';
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export async function createAuthSessionToken(
  user: { id: string; tenantId: string; role: string; email: string },
  ctx: SessionContext = {},
  db: Prisma.TransactionClient = prisma,
) {
  requireEmployeeAccount(user);
  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });
  await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    token,
    ...ctx,
    expiresInMs: AUTH_COOKIE_OPTIONS.maxAge,
  }, db);
  return token;
}

export async function issueAuthSession(
  user: { id: string; tenantId: string; role: string; email: string },
  ctx: SessionContext = {},
) {
  const token = await createAuthSessionToken(user, ctx);
  return { token, user: await readAuthUser(user.id, user.tenantId) };
}
