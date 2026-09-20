import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app-error';
import type { PermissionKey } from '../../shared/constants/permissions';
import { findUserEffectivePermissions } from '../../modules/administration/roles/roles.repository';

/** Permission flags come only from active, tenant-scoped RBAC assignments. */
export function authorize(permission: PermissionKey) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    const { userId, tenantId, role } = req.user;
    if (permission === 'admin.access') {
      return next(role === 'System Admin' ? undefined : new AppError('Access denied', 403));
    }
    if (role === 'System Admin') return next(new AppError('Use the System Admin portal.', 403));
    if (role === 'Client Admin') return next();
    if (role.trim().toLowerCase() === 'guest') return next(new AppError('Access denied', 403));
    try {
      const permissions = await findUserEffectivePermissions(userId, tenantId);
      const dot = permission.lastIndexOf('.');
      const module = permission.slice(0, dot);
      const action = permission.slice(dot + 1);
      const flag = action === 'view' ? 'canView' : action === 'create' ? 'canCreate' : action === 'delete' ? 'canDelete' : 'canEdit';
      if (!permissions[module]?.[flag]) return next(new AppError('Access denied', 403));
      next();
    } catch (err) { next(err); }
  };
}
