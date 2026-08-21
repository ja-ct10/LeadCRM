import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app-error';
import { DEFAULT_ROLE_PERMISSIONS } from '../../core/permissions/permission.registry';
import type { PermissionKey } from '../../shared/constants/permissions';

// These roles bypass all permission checks (case-insensitive, normalized)
const SUPER_ROLES = ['admin', 'super user', 'client admin', 'system admin', 'client_admin', 'clientadmin', 'superuser', 'systemadmin'];

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

    // Super roles bypass all checks (case-insensitive, whitespace/underscore normalized)
    const role = req.user.role ?? '';
    const normalizedRole = role.toLowerCase().trim().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ');
    if (SUPER_ROLES.includes(normalizedRole)) {
      return next();
    }
    // Also check with all separators removed (catches CLIENT_ADMIN → clientadmin)
    const compactRole = role.toLowerCase().replace(/[\s_\-]/g, '');
    if (SUPER_ROLES.includes(compactRole)) {
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
