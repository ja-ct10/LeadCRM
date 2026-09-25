import type { Request, Response, NextFunction } from 'express';
import { changePassword } from './change-password.service';
import { AUTH_COOKIE_NAME } from './auth-session';
export async function changePasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME] ?? req.headers.authorization?.replace(/^Bearer /, '');
    const user = await changePassword(req.user!, req.body, token);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: { user } });
  } catch (error) { next(error); }
}
