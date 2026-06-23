import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app-error';

// Client Admin bypasses all permission checks for their own tenant
const SUPER_ROLES = ['Client Admin', 'System Admin'];

export function authorize(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (SUPER_ROLES.includes(req.user.role)) {
      return next();
    }

    // TODO: resolve permissions from DB/cache by role
    // For now, forward — permission registry will be wired in Phase 2
    next();
  };
}
