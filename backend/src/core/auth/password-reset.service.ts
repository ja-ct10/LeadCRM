import prisma from '../../config/database.config';
import crypto from 'crypto';
import { comparePassword, hashPassword } from '../../shared/helpers/crypto';
import { AppError } from '../../shared/errors/app-error';
import { sendMail, buildPasswordResetEmail } from '../../shared/services/email.service';
import type { ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { StrongPasswordSchema } from '@leadcrm/shared';
import { getAuthAppOrigin, getPasswordResetTtlMinutes } from '../../shared/helpers/auth-email-config';

/**
 * Step 1 — Request a password reset.
 * Generates a secure token, stores it in PasswordResetToken, and emails the link.
 * Always returns success to avoid leaking whether an email exists.
 */
export async function requestPasswordReset(dto: ForgotPasswordDto, target?: { userId: string; tenantId: string }): Promise<void> {
  const candidates = await prisma.user.findMany({ where: { email: dto.email, ...(target ? { id: target.userId, tenantId: target.tenantId } : {}) }, take: 2 });
  const user = candidates.length === 1 ? candidates[0] : null;

  // Silently return if user not found — do not reveal email existence
  if (!user) {
    if (target) throw new AppError('User not found.', 404);
    return;
  }

  const appOrigin = getAuthAppOrigin();
  const ttlMinutes = getPasswordResetTtlMinutes();

  // Invalidate only this account's previous tokens.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expires  = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { email: user.email, userId: user.id, token: rawToken, expires },
  });

  const resetUrl = new URL('/reset-password', appOrigin);
  resetUrl.searchParams.set('token', rawToken);

  const submission = await sendMail({
    to:      user.email,
    subject: 'Reset your LeadCRM password',
    html:    buildPasswordResetEmail(resetUrl.href, user.firstName),
    requireDelivery: true,
    category: 'password-reset',
  });
  if (!submission.submitted) throw new AppError('Password reset email could not be submitted.', 502);
}

/**
 * Step 2 — Confirm the reset using the token and set a new password.
 * Deletes the used token on success.
 */
export async function resetPasswordWithToken(dto: ResetPasswordDto): Promise<void> {
  StrongPasswordSchema.parse(dto.password);
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

  const candidates = await prisma.user.findMany({ where: record.userId ? { id: record.userId, email: record.email } : { email: record.email }, take: 2 });
  const user = candidates.length === 1 ? candidates[0] : null;
  if (!user) throw new AppError('User not found.', 404);

  if (user.passwordHash && await comparePassword(dto.password, user.passwordHash)) {
    throw new AppError('Choose a password different from your current password.', 400);
  }
  const passwordHash = await hashPassword(dto.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
    }),
    // Invalidate all sessions so the old password can't be reused
    prisma.session.deleteMany({ where: { userId: user.id } }),
    // Clean up the used token
    prisma.passwordResetToken.delete({ where: { token: dto.token } }),
  ]);
}
