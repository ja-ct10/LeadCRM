import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../../config/app.config';
import { AppError } from '../../shared/errors/app-error';
import { validateSession } from '../../core/auth/session.service';

export interface AuthenticatedUser {
  userId:   string;
  tenantId: string;
  role:     string;
  email:    string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Prefer HttpOnly cookie; fall back to Bearer token for API clients
  const cookieToken: string | undefined = req.cookies?.leadcrm_token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  const token = cookieToken ?? bearerToken;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    // 1. Verify JWT signature and expiry
    const payload = jwt.verify(token, appConfig.jwtSecret) as AuthenticatedUser;

    // 2. Validate against Session store — catches revoked tokens
    //    (deactivated user, forced logout, logout from all devices)
    await validateSession(token);

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401));
  }
}
