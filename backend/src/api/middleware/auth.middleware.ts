import { notificationActor } from '../../modules/notifications/notification-actor';
import { requireEmployeeAccount } from '../../core/auth/account-access';
import { isOnboardingComplete, isWorkspaceAccessible } from '@leadcrm/shared';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@leadcrm/shared';
import { readAuthUser } from '../../core/auth/auth-user';
import { appConfig } from '../../config/app.config';
import { AppError } from '../../shared/errors/app-error';
import { validateSession } from '../../core/auth/session.service';
import { tenantContext } from '../../core/tenant/tenant-context';
import { crmActor } from '../../modules/crm/access/crm-record-access.service';

export interface AuthenticatedUser {
  userId:   string;
  tenantId: string;
  role:     string;
  email:    string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authUser?: AuthUser;
      authSession?: { lastActiveAt: Date; expiresAt: Date };
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Prefer HttpOnly cookie; fall back to Bearer token for API clients
  const cookieToken: string | undefined = req.cookies?.leadcrm_token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  const token = cookieToken ?? bearerToken;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    // 1. Verify JWT signature and expiry
    const payload = jwt.verify(token, appConfig.jwtSecret) as AuthenticatedUser;

    // 2. Validate against Session store — catches revoked tokens
    //    (deactivated user, forced logout, logout from all devices)
    const passive = req.headers['x-leadcrm-passive'] === '1' || req.headers.accept?.includes('text/event-stream') || req.path?.endsWith('/events') || req.path === '/me' || req.path === '/activity';
    const session = await validateSession(token, passive ? undefined : new Date());
    if (session.userId !== payload.userId || session.tenantId !== payload.tenantId) {
      throw new AppError('Invalid or expired token', 401);
    }

    const user = await readAuthUser(payload.userId, payload.tenantId);
    if (user.status !== 'ACTIVE') throw new AppError('Account is inactive.', 401);
    await requireEmployeeAccount(user);
    const authPath = req.baseUrl?.endsWith('/auth') ? req.path : '';
    const recovery = ['/me', '/change-password', '/logout', '/activity'].includes(authPath);
    if (!isWorkspaceAccessible(user.tenantStatus)) {
      throw new AppError('Workspace access is unavailable.', 403);
    }
    if (user.mustChangePassword && !recovery) {
      throw new AppError('Change your password first.', 403, 'PASSWORD_CHANGE_REQUIRED');
    }
    if (!isOnboardingComplete(user) && !recovery &&
        !['/onboarding/status', '/onboarding/complete'].includes(authPath)) {
      throw new AppError('Complete the LeadCRM introduction first.', 403, 'ONBOARDING_REQUIRED');
    }
    req.authUser = user;
    req.authSession = session;
    req.user = { ...payload, role: user.role, email: user.email };
    tenantContext.run({ tenantId: user.tenantId }, () => crmActor.run({ userId: user.id, tenantId: user.tenantId,
      readRecords: ['GET', 'HEAD'].includes(req.method) || /\/(duplicate-check|merge\/preview)$/.test(req.path),
    }, () => notificationActor.run(user.id, next)));
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.NotBeforeError) {
      return next(new AppError('Invalid or expired token', 401));
    }
    // A database outage is a retryable server failure, not proof of a missing session.
    next(err);
  }
}
