import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app-error';

/**
 * Ensures every request beyond this point has a valid tenantId.
 * tenantId is always taken from the JWT — never from the request body.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.tenantId) {
    throw new AppError('Tenant context required', 403);
  }
  next();
}
