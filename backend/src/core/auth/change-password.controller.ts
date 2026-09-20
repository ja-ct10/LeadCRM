import type { Request, Response, NextFunction } from 'express';
import { changePassword } from './change-password.service';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './auth-session';
export async function changePasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    await changePassword(req.user!, req.body);
    const { maxAge: _maxAge, ...options } = AUTH_COOKIE_OPTIONS;
    res.clearCookie(AUTH_COOKIE_NAME, options);
    res.json({ success: true });
  } catch (error) { next(error); }
}
