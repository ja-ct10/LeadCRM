import type { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database.config';
import { hashPassword } from '../../shared/helpers/crypto';
import { loginUser } from './auth.service';
import { createLockoutProof, restoreLoginLockout, LoginLockedError, LOGIN_LOCKOUT_COOKIE, LOGIN_LOCKOUT_COOKIE_OPTIONS } from './login-attempt.service';
import { requestPasswordReset, resetPasswordWithToken } from './password-reset.service';
import { ForgotPasswordSchema, ResetPasswordSchema } from './auth.dto';
import { revokeSession, validateSession } from './session.service';
import { SESSION_IDLE_MS } from '@leadcrm/shared';
import { readAuthUser } from './auth-user';
import { AUTH_COOKIE_NAME as COOKIE_NAME, AUTH_COOKIE_OPTIONS as COOKIE_OPTIONS } from './auth-session';
import { ensureSalesGroup } from '../../modules/administration/groups/sales-group';
import { tenantContext } from '../tenant/tenant-context';
export {
  getOnboardingStatus, updateOnboardingStep, completeOnboarding,
  saveOnboardingWorkspace,
} from './onboarding.controller';


export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const result = await loginUser(req.body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.setHeader('Cache-Control', 'no-store');
    // Token stored in HttpOnly cookie — never accessible from JS
    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);

    res.json({ success: true, data: { user: result.user, session: sessionMetadata(await validateSession(result.token)) } });
  } catch (err) {
    if (err instanceof LoginLockedError) {
      res.cookie(LOGIN_LOCKOUT_COOKIE, createLockoutProof(err), { ...LOGIN_LOCKOUT_COOKIE_OPTIONS, expires: new Date(err.retryAt!) });
    }
    next(err);
  }
}

export async function loginLockout(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await restoreLoginLockout(req.cookies?.[LOGIN_LOCKOUT_COOKIE], req.body.email)); }
  catch (error) { next(error); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_NAME] ?? req.headers.authorization?.replace(/^Bearer /, '');
    if (token) await revokeSession(token);
    const { maxAge: _maxAge, ...options } = COOKIE_OPTIONS;
    res.clearCookie(COOKIE_NAME, options);
    res.json({ success: true });
  } catch (error) { next(error); }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, tenantId } = req.user!;
    res.json({ success: true, data: { user: req.authUser ?? await readAuthUser(userId, tenantId), session: sessionMetadata(req.authSession!) } });
  } catch (error) { next(error); }
}

function sessionMetadata(session: { lastActiveAt: Date; expiresAt: Date }) {
  return { lastActiveAt: session.lastActiveAt.toISOString(), idleExpiresAt: new Date(+session.lastActiveAt + SESSION_IDLE_MS).toISOString(), expiresAt: session.expiresAt.toISOString(), serverNow: new Date().toISOString() };
}
export async function activity(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME] ?? req.headers.authorization?.replace(/^Bearer /, '');
    const session = await validateSession(token, new Date(req.body.lastActiveAt), true);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: { session: sessionMetadata(session) } });
  } catch (error) { next(error); }
}

const DEMO_EMAIL = 'admin@democorp.com';

export async function seedDemo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const demoPassword = process.env.DEMO_USER_PASSWORD;
    if (!demoPassword) {
      res.status(400).json({
        success: false,
        error: 'DEMO_USER_PASSWORD is not set on the server.',
      });
      return;
    }

    const tenant = await prisma.tenant.upsert({
      where:  { slug: 'demo-corp' },
      update: {},
      create: {
        name:               'Demo Corp Solutions',
        slug:               'demo-corp',
        status:             'ACTIVE',
      },
    });

    const passwordHash = await hashPassword(demoPassword);

    await tenantContext.run({ tenantId: tenant.id }, () => prisma.$transaction(tx => ensureSalesGroup(tx, tenant.id), { isolationLevel: 'Serializable' }));

    await prisma.user.upsert({
      where:  { tenantId_email: { tenantId: tenant.id, email: DEMO_EMAIL } },
      update: { passwordHash, status: 'ACTIVE' },
      create: {
        tenantId:  tenant.id,
        email:     DEMO_EMAIL,
        firstName: 'Alice',
        lastName:  'Admin',
        passwordHash,
        role:      'Client Admin',
        status:    'ACTIVE',
      },
    });

    // Never return credentials in an API response — the operator set the
    // password via DEMO_USER_PASSWORD and already knows it.
    res.json({ success: true, message: 'Demo user successfully seeded.', email: DEMO_EMAIL });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await requestPasswordReset(parsed.data));
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' });
      return;
    }
    await resetPasswordWithToken(parsed.data);
    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
}
