import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../../config/app.config';
import { AppError } from '../../shared/errors/app-error';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Prefer HttpOnly cookie; fall back to Bearer token for API clients
  const cookieToken: string | undefined = req.cookies?.leadcrm_token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  const token = cookieToken ?? bearerToken;

  if (!token) {
    throw new AppError('Authentication required', 401);
  }

  try {
    const payload = jwt.verify(token, appConfig.jwtSecret) as AuthenticatedUser;
    req.user = payload;
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}
