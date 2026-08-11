import { createHash } from 'crypto';
import { AppError } from '../../shared/errors/app-error';

import prisma from '../../config/database.config';

/**
 * Hash a JWT token for safe storage.
 * We never store the raw token — only its SHA-256 hash.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new session record after successful login.
 */
export async function createSession(params: {
  userId: string;
  tenantId: string;
  token: string;
  userAgent?: string;
  ipAddress?: string;
  expiresInMs: number;
}): Promise<void> {
  const tokenHash = hashToken(params.token);
  const expiresAt = new Date(Date.now() + params.expiresInMs);

  await prisma.session.create({
    data: {
      userId:    params.userId,
      tenantId:  params.tenantId,
      tokenHash,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt,
    },
  });
}

/**
 * Validate a token hash against the session store.
 * Returns the session or throws 401 if invalid/revoked/expired.
 */
export async function validateSession(token: string): Promise<{ userId: string; tenantId: string }> {
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({ where: { tokenHash } });

  if (!session) {
    throw new AppError('Session not found — please log in again', 401);
  }
  if (session.revokedAt) {
    throw new AppError('Session has been revoked — please log in again', 401);
  }
  if (session.expiresAt < new Date()) {
    throw new AppError('Session has expired — please log in again', 401);
  }

  // Throttle lastActiveAt writes to at most once per 5 minutes.
  // The session record was already fetched above — reuse it to avoid
  // an extra DB read. Only write if the timestamp is stale.
  const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
  if (Date.now() - session.lastActiveAt.getTime() > LAST_ACTIVE_THROTTLE_MS) {
    prisma.session
      .update({ where: { tokenHash }, data: { lastActiveAt: new Date() } })
      .catch(() => {/* non-critical */});
  }
  return { userId: session.userId, tenantId: session.tenantId };
}

/**
 * Revoke a specific session on logout.
 */
export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session
    .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
    .catch(() => {/* session may not exist — safe to ignore */});
}

/**
 * Revoke ALL sessions for a user (forced logout, account deactivation).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

/**
 * Purge expired sessions — run periodically (e.g. daily cron).
 */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
