import prisma from '../../config/database.config';
import crypto from 'crypto';
import { comparePassword, hashPassword } from '../../shared/helpers/crypto';
import { signToken } from './jwt.service';
import { createSession } from './session.service';
import { AppError } from '../../shared/errors/app-error';
import { ConflictError } from '../../shared/errors/http-error';
import { sendMail, buildPasswordResetEmail, buildRegistrationOtpEmail } from '../../shared/services/email.service';
import type { ForgotPasswordDto, ResetPasswordDto } from './auth.dto';



// JWT lifetime in milliseconds (must match jwt.service expiresIn)
const JWT_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantId: string;
}

export interface LoginContext {
  userAgent?: string;
  ipAddress?: string;
}

export async function loginUser(dto: LoginDto, ctx: LoginContext = {}) {
  const user = await prisma.user.findFirst({
    where: { email: dto.email },
  });

  // Generic message — do not reveal whether email exists
  if (!user) throw new AppError('Invalid email or password', 401);

  // OAuth-only users have no password — reject password login attempts
  if (!user.passwordHash) throw new AppError('Invalid email or password', 401);

  const valid = await comparePassword(dto.password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401);

  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is inactive. Contact your administrator.', 403);
  }

  const token = signToken({
    userId:   user.id,
    tenantId: user.tenantId,
    role:     user.role,
    email:    user.email,
  });

  // Persist session for revocation support
  await createSession({
    userId:      user.id,
    tenantId:    user.tenantId,
    token,
    userAgent:   ctx.userAgent,
    ipAddress:   ctx.ipAddress,
    expiresInMs: JWT_EXPIRES_MS,
  });

  return {
    token,
    user: {
      id:        user.id,
      email:     user.email,
      role:      user.role,
      firstName: user.firstName,
      lastName:  user.lastName,
      tenantId:  user.tenantId,
    },
  };
}

export async function registerUser(dto: RegisterDto) {
  const existing = await prisma.user.findFirst({
    where: { email: dto.email, tenantId: dto.tenantId },
  });

  if (existing) throw new ConflictError('A user with this email already exists');

  const passwordHash = await hashPassword(dto.password);

  const user = await prisma.user.create({
    data: {
      // tenantId always from system context — never from client body
      tenantId:     dto.tenantId,
      firstName:    dto.firstName,
      lastName:     dto.lastName,
      email:        dto.email,
      passwordHash,
    },
  });

  return { id: user.id, email: user.email, role: user.role };
}

import { ClientAdminRegisterDto, GuestRegisterDto } from './auth.dto';

export async function registerClientAdmin(dto: ClientAdminRegisterDto) {
  const existingUser = await prisma.user.findFirst({
    where: { email: dto.email },
  });

  if (existingUser) throw new ConflictError('A user with this email already exists');

  const passwordHash = await hashPassword(dto.password);

  // Generate a unique slug for the tenant
  const slug = dto.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

  // We use a transaction to ensure everything is created together
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Tenant
    const tenant = await tx.tenant.create({
      data: {
        name: dto.companyName,
        slug,
        industry: dto.industry,
        companySize: dto.companySize,
        status: 'ACTIVE',
        subscriptionStatus: 'TRIAL',
        plan: 'FREE',
      },
    });

    // 2. Create User
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: 'Client Admin',
        status: 'ACTIVE',
      },
    });

    // 3. Create Account (replaces Organization)
    await tx.account.create({
      data: {
        tenantId: tenant.id,
        name: dto.companyName,
        industry: dto.industry,
        size: dto.companySize,
        country: dto.country,
      } as never,
    });

    return { tenant, user };
  });

  return { id: result.user.id, email: result.user.email, role: result.user.role, tenantId: result.tenant.id };
}

export async function registerGuest(dto: GuestRegisterDto) {
  const existingUser = await prisma.user.findFirst({
    where: { email: dto.email },
  });

  if (existingUser) throw new ConflictError('A user with this email already exists');

  const passwordHash = await hashPassword(dto.password);
  
  // Guest gets their own sandbox tenant
  const slug = 'sandbox-' + Math.random().toString(36).substring(2, 10);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: dto.companyName || 'Demo Sandbox',
        slug,
        industry: dto.industry,
        companySize: dto.companySize,
        status: 'SANDBOX',
        subscriptionStatus: 'TRIAL',
        plan: 'FREE',
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: 'Guest',
        status: 'PENDING', // Set to PENDING until email is verified
        // emailVerified will be null until verified
      },
    });

    const organization = await tx.account.create({
      data: {
        tenantId: tenant.id,
        name: dto.companyName || 'Demo Sandbox Org',
      } as never,
    });

    // Seed some basic data for the guest
    const pipeline = await tx.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Pipeline',
        isDefault: true,
        stages: {
          create: [
            { name: 'Lead', order: 1, isDefault: true, tenantId: tenant.id },
            { name: 'Contacted', order: 2, tenantId: tenant.id },
            { name: 'Qualified', order: 3, tenantId: tenant.id },
            { name: 'Won', order: 4, isWon: true, tenantId: tenant.id },
            { name: 'Lost', order: 5, isLost: true, tenantId: tenant.id },
          ]
        }
      }
    });

    return { tenant, user };
  });

  return { id: result.user.id, email: result.user.email, role: result.user.role, tenantId: result.tenant.id };
}

// ── Registration Email Verification (OTP) ─────────────────────────

const REG_OTP_TTL_MS       = 10 * 60 * 1000; // 10 minutes
const REG_OTP_MAX_ATTEMPTS = 5;

/**
 * Sends a 6-digit verification code to the given email during registration.
 * Does NOT require an existing user account — called before the account is activated.
 */
export async function sendRegistrationOtp(email: string): Promise<void> {
  const code     = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashPassword(code);
  const expires  = new Date(Date.now() + REG_OTP_TTL_MS);

  await prisma.registrationOtpToken.upsert({
    where:  { email },
    update: { codeHash, expires, attempts: 0 },
    create: { email, codeHash, expires },
  });

  await sendMail({
    to:      email,
    subject: `${code} is your LeadCRM verification code`,
    html:    buildRegistrationOtpEmail(code),
  });
}

/**
 * Verifies a registration OTP code. Returns true on success.
 * Throws AppError on failure (expired, wrong code, too many attempts).
 * Activates the user account upon successful verification.
 */
export async function verifyRegistrationOtp(email: string, code: string): Promise<boolean> {
  const record = await prisma.registrationOtpToken.findUnique({ where: { email } });

  if (!record) throw new AppError('No verification code found for this email. Please request a new one.', 400);

  if (record.expires < new Date()) {
    await prisma.registrationOtpToken.delete({ where: { email } });
    throw new AppError('Verification code has expired. Please request a new one.', 400);
  }

  if (record.attempts >= REG_OTP_MAX_ATTEMPTS) {
    await prisma.registrationOtpToken.delete({ where: { email } });
    throw new AppError('Too many incorrect attempts. Please request a new code.', 429);
  }

  const valid = await comparePassword(code, record.codeHash);
  if (!valid) {
    await prisma.registrationOtpToken.update({
      where: { email },
      data:  { attempts: { increment: 1 } },
    });
    const remaining = REG_OTP_MAX_ATTEMPTS - record.attempts - 1;
    throw new AppError(`Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 400);
  }

  // Code verified — activate the user account
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data:  { status: 'ACTIVE', emailVerified: new Date() },
    });
  }

  await prisma.registrationOtpToken.delete({ where: { email } });
  return true;
}

// ── Password Reset ────────────────────────────────────────────────
const RESET_TTL_MS = parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '60', 10) * 60 * 1000;

/**
 * Step 1 — Request a password reset.
 * Generates a secure token, stores it in PasswordResetToken, and emails the link.
 * Always returns success to avoid leaking whether an email exists.
 * In development, if SMTP is not configured, logs the reset URL to the console.
 */
export async function requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email: dto.email } });

  // Silently return if user not found — do not reveal email existence
  if (!user) return;

  // Invalidate any previous tokens for this email
  await prisma.passwordResetToken.deleteMany({ where: { email: dto.email } });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expires  = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { email: dto.email, token: rawToken, expires },
  });

  const appUrl   = process.env.APP_URL ?? 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  await sendMail({
    to:      dto.email,
    subject: 'Reset your LeadCRM password',
    html:    buildPasswordResetEmail(resetUrl),
  });
}

/**
 * Step 2 — Confirm the reset using the token and set a new password.
 * Deletes the used token on success.
 */
export async function resetPasswordWithToken(dto: ResetPasswordDto): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: dto.token },
  });

  if (!record) {
    throw new AppError('Invalid or expired password reset link.', 400);
  }

  if (record.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token: dto.token } });
    throw new AppError('Password reset link has expired. Please request a new one.', 400);
  }

  const user = await prisma.user.findFirst({ where: { email: record.email } });
  if (!user) throw new AppError('User not found.', 404);

  const passwordHash = await hashPassword(dto.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash },
    }),
    // Invalidate all sessions so the old password can't be reused
    prisma.session.deleteMany({ where: { userId: user.id } }),
    // Clean up the used token
    prisma.passwordResetToken.delete({ where: { token: dto.token } }),
  ]);
}


