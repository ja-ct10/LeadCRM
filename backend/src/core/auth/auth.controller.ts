import { Request, Response, NextFunction } from 'express';
import { loginUser } from './auth.service';

// Controller — HTTP only. No business logic here.

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await loginUser(req.body);

    // Token in HttpOnly cookie — never accessible from JS
    res.cookie('leadcrm_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    res.json({
      success: true,
      data: { user: result.user },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('leadcrm_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ success: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  // req.user is populated by authMiddleware
  res.json({ success: true, data: { user: req.user } });
}
