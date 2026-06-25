import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import * as userController       from '../../modules/administration/users/users.controller';
import * as roleController       from '../../modules/administration/roles/roles.controller';
import * as permController       from '../../modules/administration/permissions/permissions.controller';
import * as auditController      from '../../modules/administration/audit/audit.controller';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Users ─────────────────────────────────────────────
router.get(   '/users',                authorize('users.view'),   userController.getUsers);
router.get(   '/users/:id',            authorize('users.view'),   userController.getUserById);
router.post(  '/users',                authorize('users.manage'), userController.createUser);
router.put(   '/users/:id',            authorize('users.manage'), userController.updateUser);
router.patch( '/users/:id/deactivate', authorize('users.manage'), userController.deactivateUser);

// ── Roles (RoleDefinition) ────────────────────────────
router.get(   '/roles',                authorize('roles.manage'), roleController.getRoles);
router.get(   '/roles/:id',            authorize('roles.manage'), roleController.getRoleById);
router.post(  '/roles',                authorize('roles.manage'), roleController.createRole);
router.put(   '/roles/:id',            authorize('roles.manage'), roleController.updateRole);
router.patch( '/roles/:id/archive',    authorize('roles.manage'), roleController.archiveRole);
router.post(  '/roles/assign',         authorize('roles.manage'), roleController.assignRoleToUser);
router.delete('/roles/unassign',       authorize('roles.manage'), roleController.removeRoleFromUser);

// ── Permissions (read-only reference for role builder) ─
router.get(   '/permissions',          authorize('roles.manage'), permController.getPermissions);

// ── Audit Log ─────────────────────────────────────────
router.get(   '/audit',                authorize('audit.view'),   auditController.getAuditLogs);

export default router;
