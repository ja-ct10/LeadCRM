import { randomBytes, randomInt, createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database.config';
import { hashPassword, comparePassword } from '../../shared/helpers/crypto';
import { AppError } from '../../shared/errors/app-error';
import { sendMail, buildVerificationEmail } from '../../shared/services/email.service';
import { authTransaction } from './auth-transaction';

const OTP_TTL_MS = 10 * 60 * 1000;
const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function createVerificationCredentials(
  tx: Prisma.TransactionClient,
  email: string,
  userId: string,
) {
  const token = randomBytes(32).toString('hex');
  const otpCode = String(randomInt(100000, 1000000));
  const codeHash = await hashPassword(otpCode);
  await tx.emailVerificationToken.deleteMany({ where: { email } });
  await tx.emailVerificationToken.create({
    data: {
      userId, email,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });
  const expires = new Date(Date.now() + OTP_TTL_MS);
  await tx.registrationOtpToken.upsert({
    where: { email },
    update: { codeHash, expires, attempts: 0 },
    create: { email, codeHash, expires },
  });
  return { token, otpCode };
}

export async function deliverVerification(
  email: string,
  credentials: { token: string; otpCode: string },
): Promise<boolean> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const url = `${appUrl}/api/verify-email?token=${credentials.token}`;
  try {
    await sendMail({
      to: email,
      subject: `${credentials.otpCode} - Verify your LeadCRM email`,
      html: buildVerificationEmail(url, credentials.otpCode),
    });
    return true;
  } catch {
    console.error('[Auth] Verification email delivery failed; resend remains available.');
    return false;
  }
}

async function findPendingUser(tx: Prisma.TransactionClient, email: string) {
  const users = await tx.user.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    take: 2,
  });
  const user = users.length === 1 ? users[0] : null;
  return user?.status === 'PENDING' && !user.emailVerified ? user : null;
}

export async function sendRegistrationOtp(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const credentials = await authTransaction(async tx => {
    const user = await findPendingUser(tx, normalizedEmail);
    return user
      ? createVerificationCredentials(tx, normalizedEmail, user.id)
      : null;
  });
  if (credentials) await deliverVerification(normalizedEmail, credentials);
}

async function activatePendingUser(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string },
) {
  const now = new Date();
  const updated = await tx.user.updateMany({
    where: { id: user.id, status: 'PENDING', emailVerified: null },
    data: { status: 'ACTIVE', emailVerified: now },
  });
  if (updated.count !== 1) throw new AppError('Verification is no longer valid.', 400);
  await tx.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });
  await tx.registrationOtpToken.deleteMany({ where: { email: user.email } });
  return tx.user.findUniqueOrThrow({ where: { id: user.id } });
}

export async function verifyRegistrationOtp(email: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await authTransaction(async tx => {
    const user = await findPendingUser(tx, normalizedEmail);
    const record = await tx.registrationOtpToken.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || !record || record.expires <= new Date() || record.attempts >= MAX_ATTEMPTS) {
      return { error: 'Invalid or expired code. Request a new verification email.' } as const;
    }
    if (!await comparePassword(code, record.codeHash)) {
      await tx.registrationOtpToken.update({
        where: { email: normalizedEmail },
        data: { attempts: { increment: 1 } },
      });
      return { error: 'Incorrect verification code.' } as const;
    }
    return { user: await activatePendingUser(tx, user) } as const;
  });
  // Throw after committing an incorrect attempt so rate limits cannot be rolled back.
  if ('error' in result) throw new AppError(result.error!, 400);
  return result.user;
}

export async function verifyEmailToken(rawToken: string) {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  return authTransaction(async tx => {
    const record = await tx.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new AppError('Invalid or expired verification link.', 400);
    }
    const user = record.userId
      ? await tx.user.findUnique({ where: { id: record.userId } })
      : await findPendingUser(tx, record.email);
    if (!user || user.status !== 'PENDING' || user.emailVerified) {
      throw new AppError('Verification is no longer valid. Please sign in.', 400);
    }
    return activatePendingUser(tx, user);
  });
}
