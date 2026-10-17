import { createHash } from 'crypto';
import { AppError } from '../../shared/errors/app-error';

import prisma from '../../config/database.config';
import type { Prisma } from '@prisma/client';
import { SESSION_IDLE_MS, SESSION_IDLE_MESSAGE } from '@leadcrm/shared';

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
}, db: Prisma.TransactionClient = prisma): Promise<void> {
  const tokenHash = hashToken(params.token);
  const lastActiveAt = new Date();
  const expiresAt = new Date(+lastActiveAt + params.expiresInMs);

  await db.session.create({
    data: {
      userId:    params.userId,
      tenantId:  params.tenantId,
      tokenHash,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt,
      lastActiveAt,
    },
  });
}

/**
 * Validate a token hash against the session store.
 * Returns the session or throws 401 if invalid/revoked/expired.
 */
export async function validateSession(token: string, activityAt?: Date, explicitActivity = false): Promise<{ userId: string; tenantId: string; lastActiveAt: Date; expiresAt: Date }> {
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({ where: { tokenHash } });

  if (!session) {
    throw new AppError('Session not found — please log in again', 401);
  }
  if (session.revokedAt) {
    if (+session.revokedAt - +session.lastActiveAt >= SESSION_IDLE_MS) throw new AppError(SESSION_IDLE_MESSAGE, 401, 'SESSION_IDLE_EXPIRED');
    throw new AppError('Session has been revoked — please log in again', 401);
  }
  const now = new Date();
  if (session.expiresAt <= now) {
    throw new AppError('Session has expired — please log in again', 401);
  }

  const cutoff = new Date(now.getTime() - SESSION_IDLE_MS);
  if (session.lastActiveAt <= cutoff) {
    const revoked = await prisma.session.updateMany({ where: { tokenHash, revokedAt: null, lastActiveAt: { lte: cutoff } }, data: { revokedAt: now } });
    // A concurrent valid activity update won; validate that newer state.
    if (!revoked.count) return validateSession(token, activityAt, explicitActivity);
    throw new AppError(SESSION_IDLE_MESSAGE, 401, 'SESSION_IDLE_EXPIRED');
  }
  if (activityAt && activityAt > session.lastActiveAt && (explicitActivity || +activityAt - +session.lastActiveAt >= 60000)) {
    const at = new Date(Math.min(activityAt.getTime(), now.getTime()));
    // Conditional writes cannot resurrect revoked/expired sessions or move activity backwards.
    const updated = await prisma.session.updateMany({ where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, lastActiveAt: { gt: cutoff, lt: at } }, data: { lastActiveAt: at } });
    if (updated.count) session.lastActiveAt = at;
  }
  return { userId: session.userId, tenantId: session.tenantId, lastActiveAt: session.lastActiveAt, expiresAt: session.expiresAt };
}

/**
 * Revoke a specific session on logout.
 */
export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  // Missing sessions are already logged out; database failures must reach the caller.
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
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
