import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { comparePassword, hashPassword } from '../../shared/helpers/crypto';
import { signToken } from './jwt.service';
import { createSession } from './session.service';
import { AppError } from '../../shared/errors/app-error';
import { ConflictError } from '../../shared/errors/http-error';
import { sendMail, buildPasswordResetEmail, buildLoginOtpEmail } from '../../shared/services/email.service';
import type { ForgotPasswordDto, ResetPasswordDto } from './auth.dto';

const prisma = new PrismaClient();

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

    // 3. Create Organization
    const organization = await tx.organization.create({
      data: {
        tenantId: tenant.id,
        name: dto.companyName,
        industry: dto.industry,
        size: dto.companySize,
        country: dto.country,
      },
    });

    return { tenant, user, organization };
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
        name: 'Demo Sandbox',
        slug,
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
        status: 'ACTIVE',
      },
    });

    const organization = await tx.organization.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Sandbox Org',
      },
    });

    // Seed some basic data for the guest
    const pipeline = await tx.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Pipeline',
        isDefault: true,
        stages: {
          create: [
            { name: 'Lead', order: 1, isDefault: true },
            { name: 'Contacted', order: 2 },
            { name: 'Qualified', order: 3 },
            { name: 'Won', order: 4, isWon: true },
            { name: 'Lost', order: 5, isLost: true },
          ]
        }
      }
    });

    return { tenant, user };
  });

  return { id: result.user.id, email: result.user.email, role: result.user.role, tenantId: result.tenant.id };
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

  const smtpConfigured =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!smtpConfigured) {
    // Dev fallback — log the link so the flow can be tested without real SMTP
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n[DEV] Password reset link (SMTP not configured):');
      console.log(resetUrl);
      console.log('');
    }
    return;
  }

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

// ── Login OTP ─────────────────────────────────────────────────────

const OTP_TTL_MS      = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

/**
 * Step 1 — Verify email+password, then generate and email a 6-digit OTP.
 * Always returns generic success to avoid leaking valid emails.
 */
export async function sendLoginOtp(dto: LoginDto, ctx: LoginContext = {}): Promise<void> {
  // Validate credentials first — throws if invalid
  const user = await prisma.user.findFirst({ where: { email: dto.email } });
  if (!user) throw new AppError('Invalid email or password', 401);

  const valid = await comparePassword(dto.password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401);

  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is inactive. Contact your administrator.', 403);
  }

  // Generate a 6-digit numeric code
  const code     = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashPassword(code);
  const expires  = new Date(Date.now() + OTP_TTL_MS);

  // Upsert — one active OTP per email at a time
  await prisma.loginOtpToken.upsert({
    where:  { email: dto.email },
    update: { codeHash, expires, attempts: 0 },
    create: { email: dto.email, codeHash, expires },
  });

  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!smtpConfigured) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[DEV] Login OTP for ${dto.email}: ${code}\n`);
    }
    return;
  }

  await sendMail({
    to:      dto.email,
    subject: `${code} is your LeadCRM login code`,
    html:    buildLoginOtpEmail(code),
  });
}

/**
 * Step 2 — Verify OTP and issue JWT session.
 */
export async function verifyLoginOtp(email: string, code: string, ctx: LoginContext = {}) {
  const record = await prisma.loginOtpToken.findUnique({ where: { email } });

  if (!record) throw new AppError('Invalid or expired code.', 401);

  if (record.expires < new Date()) {
    await prisma.loginOtpToken.delete({ where: { email } });
    throw new AppError('Your code has expired. Please sign in again.', 401);
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.loginOtpToken.delete({ where: { email } });
    throw new AppError('Too many incorrect attempts. Please sign in again.', 429);
  }

  const valid = await comparePassword(code, record.codeHash);
  if (!valid) {
    await prisma.loginOtpToken.update({
      where: { email },
      data:  { attempts: { increment: 1 } },
    });
    const remaining = OTP_MAX_ATTEMPTS - record.attempts - 1;
    throw new AppError(`Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 401);
  }

  // OTP verified — delete it and issue session
  await prisma.loginOtpToken.delete({ where: { email } });

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new AppError('User not found.', 404);

  const token = signToken({
    userId:   user.id,
    tenantId: user.tenantId,
    role:     user.role,
    email:    user.email,
  });

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
