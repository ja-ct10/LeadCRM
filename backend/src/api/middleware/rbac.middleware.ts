import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app-error';
import type { PermissionKey } from '../../shared/constants/permissions';
import { assertPermissions } from '../../core/permissions/permission.service';

/** Permission flags come only from active, tenant-scoped RBAC assignments. */
export function authorize(permission: PermissionKey) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    try {
      await assertPermissions(req.user, [permission]);
      next();
    } catch (err) { next(err); }
  };
}
