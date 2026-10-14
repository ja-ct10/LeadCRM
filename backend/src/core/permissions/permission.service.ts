import { AppError } from '../../shared/errors/app-error';
import type { PermissionKey } from '../../shared/constants/permissions';
import { findUserEffectivePermissions } from '../../modules/administration/roles/roles.repository';
import { Permission, PERMISSION_ACTION_KEYS, PERMISSION_ACTIONS, hasModulePermission } from '@leadcrm/shared';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database.config';

/** Shared by request guards and server-side automation; uses current tenant role assignments. */
export async function assertPermissions(user: {userId:string;tenantId:string;role:string}, required: PermissionKey[], db: Prisma.TransactionClient = prisma) {
  if (required.some(key => !Object.values(Permission).includes(key))) throw new AppError('Unknown permission', 403);
  const permissions = await findUserEffectivePermissions(user.userId, user.tenantId, db);
  for (const permission of required) {
    const dot = permission.lastIndexOf('.'), module = permission.slice(0, dot), action = permission.slice(dot + 1);
    const flag = PERMISSION_ACTIONS.find(flag => PERMISSION_ACTION_KEYS[flag] === action);
    if (!flag || !hasModulePermission(permissions, module, flag)) throw new AppError('Access denied', 403);
  }
}
