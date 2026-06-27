import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app-error';
import { DEFAULT_ROLE_PERMISSIONS } from '../../core/permissions/permission.registry';
import type { PermissionKey } from '../../shared/constants/permissions';

// These roles bypass all permission checks
const SUPER_ROLES = ['Client Admin', 'System Admin'];

/**
 * authorize(permission) — RBAC middleware factory.
 *
 * Execution order on every protected route:
 *   authenticate → authorize('permission.key') → validate → controller
 *
 * Client Admin: full access to their tenant. No permission check needed.
 * System Admin: full access cross-tenant. No permission check needed.
 * All other roles: resolved from DEFAULT_ROLE_PERMISSIONS registry.
 */
export function authorize(permission: PermissionKey) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Super roles bypass all checks
    if (SUPER_ROLES.includes(req.user.role)) {
      return next();
    }

    // Resolve permissions for this role from the registry
    const rolePermissions: string[] = DEFAULT_ROLE_PERMISSIONS[req.user.role] ?? [];

    if (!rolePermissions.includes(permission)) {
      throw new AppError(
        `Access denied — missing permission: ${permission}`,
        403,
      );
    }

    next();
  };
}
