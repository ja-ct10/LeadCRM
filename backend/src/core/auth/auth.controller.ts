import { Request, Response, NextFunction } from 'express';
import { loginUser } from './auth.service';
import { revokeSession } from './session.service';

const COOKIE_NAME = 'leadcrm_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
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

    res.json({ success: true, data: { user: result.user } });
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

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: { user: req.user } });
}
