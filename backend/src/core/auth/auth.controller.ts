import type { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database.config';
import { hashPassword } from '../../shared/helpers/crypto';
import { Role } from '../../shared/constants/roles';
import { loginUser } from './auth.service';
import { acceptInvitation as acceptInvitationService } from './registration.service';
import { requestPasswordReset, resetPasswordWithToken } from './password-reset.service';
import { ForgotPasswordSchema, ResetPasswordSchema } from './auth.dto';
import { revokeSession } from './session.service';
import { readAuthUser } from './auth-user';
import { AUTH_COOKIE_NAME as COOKIE_NAME, AUTH_COOKIE_OPTIONS as COOKIE_OPTIONS } from './auth-session';
export { sendRegOtp, verifyRegOtp, verifyEmailByLink, resendVerification } from './verification.controller';
export { oauthGoogle } from './oauth.controller';
export {
  getOnboardingStatus, updateOnboardingStep, completeOnboarding,
  saveOnboardingWorkspace, completeOAuthProfile,
} from './onboarding.controller';

/**
 * GET /api/v1/auth/sandbox-info
 * Returns sandbox configuration for development/testing.
 * Public endpoint — no authentication required.
 */
export async function getSandboxInfo(req: Request, res: Response): Promise<void> {
  // Sandbox mode was Resend-specific — Gmail API sends to any address without restrictions.
  res.json({
    success: true,
    data: {
      isSandboxMode: false,
      allowedEmails: [],
      isDevelopment: process.env.NODE_ENV !== 'production',
    },
  });
}

/**
 * GET /api/v1/auth/check-email?email=...
 * Checks if an email is already in use without exposing other user details.
 */
export async function checkEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = (req.query.email as string || '').toLowerCase().trim();
    if (!email) {
      res.json({ success: true, data: { exists: false } });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    res.json({ success: true, data: { exists: !!user } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await loginUser(req.body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Token stored in HttpOnly cookie — never accessible from JS
    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);

    res.json({ success: true, data: { user: result.user } });
  } catch (err) {
    next(err);
  }
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
    res.json({ success: true, data: { user: req.authUser ?? await readAuthUser(userId, tenantId) } });
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

export async function acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await acceptInvitationService(req.body);
    res.status(201).json({
      success: true,
      data: { user: result },
    });
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
    await requestPasswordReset(parsed.data);
    // Always return success — never reveal whether the email exists
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
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

/**
 * POST /api/v1/auth/seed-admin
 *
 * Upserts the canonical System Admin user so that a broken or missing account
 * can be repaired without direct database access.
 *
 * Protection:
 *   - In production: requires the `x-seed-admin-secret` request header to
 *     match the SEED_ADMIN_SECRET environment variable. If SEED_ADMIN_SECRET
 *     is not configured, the endpoint returns 404 (effectively disabled).
 *   - In non-production: open for local developer convenience.
 *
 * Credentials are never returned or logged. All DB operations are idempotent
 * upserts — safe to call repeatedly.
 */
export async function seedAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // ── Production guard ───────────────────────────────────────────────────
    // Block arbitrary callers from provisioning or repairing the privileged
    // System Admin account in production.
    if (process.env.NODE_ENV === 'production') {
      const expectedSecret = process.env.SEED_ADMIN_SECRET;

      // SEED_ADMIN_SECRET not configured → endpoint is disabled in this environment.
      if (!expectedSecret) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }

      const providedSecret = req.headers['x-seed-admin-secret'];
      if (!providedSecret || providedSecret !== expectedSecret) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
    }

    // ── Env var guard ──────────────────────────────────────────────────────
    const rawEmail    = process.env.SYSTEM_ADMIN_EMAIL;
    const rawPassword = process.env.SYSTEM_ADMIN_PASSWORD;

    if (!rawEmail || !rawPassword) {
      res.status(400).json({
        success: false,
        error:   'SYSTEM_ADMIN_EMAIL or SYSTEM_ADMIN_PASSWORD not set.',
      });
      return;
    }

    // Normalise email to avoid casing mismatches during login lookup.
    const email = rawEmail.toLowerCase().trim();

    // ── System tenant upsert ───────────────────────────────────────────────
    // Ensure the reserved system tenant exists and is properly configured so
    // AuthGuard's onboarding checks can never block System Admin.
    const tenant = await prisma.tenant.upsert({
      where:  { slug: 'leadcrm-system' },
      update: {
        status:                'ACTIVE',
        onboardingStep:        3,
        onboardingCompletedAt: new Date(),
      },
      create: {
        name:                  'LeadCRM System',
        slug:                  'leadcrm-system',
        status:                'ACTIVE',
        onboardingStep:        3,
        onboardingCompletedAt: new Date(),
      },
    });

    // ── System Admin user upsert ───────────────────────────────────────────
    // Always re-applies the correct role, status, and emailVerified so a
    // previously broken row (e.g. emailVerified = null) is repaired on call.
    // The @@unique([tenantId, email]) constraint backs the where clause.
    const passwordHash = await hashPassword(rawPassword);

    await prisma.user.upsert({
      where:  { tenantId_email: { tenantId: tenant.id, email } },
      update: {
        passwordHash,
        status:        'ACTIVE',
        role:          Role.SYSTEM_ADMIN,
        emailVerified: new Date(),
      },
      create: {
        tenantId:      tenant.id,
        email,
        firstName:     'System',
        lastName:      'Admin',
        passwordHash,
        role:          Role.SYSTEM_ADMIN,
        status:        'ACTIVE',
        emailVerified: new Date(),
      },
    });

    // Never return or log credentials — the caller already knows the password.
    res.json({
      success: true,
      message: 'System Admin provisioned successfully.',
      email,
    });
  } catch (err) {
    next(err);
  }
}
