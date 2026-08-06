import { Request, Response, NextFunction } from 'express';
import {
  loginUser,
  registerClientAdmin as registerClientAdminService,
  registerGuest as registerGuestService,
  requestPasswordReset,
  resetPasswordWithToken,
  sendLoginOtp,
  verifyLoginOtp,
} from './auth.service';
import { revokeSession } from './session.service';
import prisma from '../../config/database.config';
import { hashPassword } from '../../shared/helpers/crypto';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SendOtpSchema,
  VerifyOtpSchema,
} from './auth.dto';

const COOKIE_NAME = 'leadcrm_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await loginUser(req.body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Token stored in HttpOnly cookie — never accessible from JS
    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);

    res.json({ success: true, data: { user: result.user, token: result.token } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  // Revoke the session server-side before clearing the cookie
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (token) await revokeSession(token);

  res.clearCookie(COOKIE_NAME, {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure:   COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
  });

  res.json({ success: true });
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Fetch full user from DB so firstName/lastName are included
    const user = await prisma.user.findFirst({
      where: { id: req.user!.userId, tenantId: req.user!.tenantId },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, tenantId: true, status: true },
    });
    if (!user) { res.status(401).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
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
        subscriptionStatus: 'ACTIVE',
        plan:               'ENTERPRISE',
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

export async function registerClientAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await registerClientAdminService(req.body);
    res.status(201).json({ success: true, data: { user: result } });
  } catch (err) {
    next(err);
  }
}

export async function registerGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await registerGuestService(req.body);
    res.status(201).json({ success: true, data: { user: result } });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Mock implementation for now
    res.json({ success: true, message: 'Email verified successfully.' });
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

export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = SendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' });
      return;
    }
    await sendLoginOtp(parsed.data, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.json({ success: true, message: 'OTP sent to your email address.' });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = VerifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' });
      return;
    }
    const result = await verifyLoginOtp(parsed.data.email, parsed.data.code, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
    res.json({ success: true, data: { user: result.user, token: result.token } });
  } catch (err) {
    next(err);
  }
}

export async function seedAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email    = process.env.SYSTEM_ADMIN_EMAIL;
    const password = process.env.SYSTEM_ADMIN_PASSWORD;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'SYSTEM_ADMIN_EMAIL or SYSTEM_ADMIN_PASSWORD not set.' });
      return;
    }

    const tenant = await prisma.tenant.upsert({
      where:  { slug: 'leadcrm-system' },
      update: {},
      create: {
        name:               'LeadCRM System',
        slug:               'leadcrm-system',
        status:             'ACTIVE',
        subscriptionStatus: 'ACTIVE',
        plan:               'ENTERPRISE',
      },
    });

    const existing = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } });

    if (!existing) {
      const passwordHash = await hashPassword(password);
      await prisma.user.create({
        data: {
          tenantId:     tenant.id,
          email,
          firstName:    'System',
          lastName:     'Admin',
          passwordHash,
          role:         'System Admin',
          status:       'ACTIVE',
        },
      });
    }

    res.json({
      success: true,
      message: existing ? 'System Admin already exists.' : 'System Admin created successfully.',
      email,
    });
  } catch (err) {
    next(err);
  }
}
