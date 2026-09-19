import type { Request, Response, NextFunction } from 'express';
import { SendRegistrationOtpSchema, VerifyRegistrationOtpSchema } from './auth.dto';
import { sendRegistrationOtp, verifyRegistrationOtp, verifyEmailToken } from './verification.service';
import { issueAuthSession, AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './auth-session';
import { AppError } from '../../shared/errors/app-error';

export async function sendRegOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = SendRegistrationOtpSchema.parse(req.body);
    await sendRegistrationOtp(email);
    res.json({ success: true, message: 'If verification is pending, a new email has been sent.' });
  } catch (error) { next(error); }
}
export const resendVerification = sendRegOtp;

export async function verifyRegOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, code } = VerifyRegistrationOtpSchema.parse(req.body);
    const verifiedUser = await verifyRegistrationOtp(email, code);
    const result = await issueAuthSession(verifiedUser, {
      userAgent: req.headers['user-agent'], ipAddress: req.ip,
    });
    res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
    res.json({ success: true, data: { user: result.user } });
  } catch (error) { next(error); }
}

export async function verifyEmailByLink(req: Request, res: Response, next: NextFunction) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const token = req.query.token;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return next(new AppError('Invalid verification link.', 400));
  }
  // Old emailed backend links hand off before consuming the token. Only the
  // frontend server bridge consumes it and forwards the cookie to the page origin.
  if (!req.headers.accept?.includes('application/json')) {
    res.redirect(`${appUrl}/api/verify-email?token=${encodeURIComponent(token)}`);
    return;
  }
  try {
    const verifiedUser = await verifyEmailToken(token);
    const result = await issueAuthSession(verifiedUser, {
      userAgent: req.headers['user-agent'], ipAddress: req.ip,
    });
    res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
    res.json({ success: true, data: { user: result.user } });
  } catch (error) { next(error); }
}
