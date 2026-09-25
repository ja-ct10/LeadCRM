import { CreateUsersSchema, UpdateUsersSchema } from '../../modules/administration/users/users.dto';
import { passwordResetRateLimiter } from '../middleware/rate-limit.middleware';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware, workspaceReadyMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { UpdateOrganizationSettingsSchema } from '@leadcrm/shared';
import * as organizationSettings from '../../modules/administration/organization-settings/organization-settings.controller';
import * as userController       from '../../modules/administration/users/users.controller';
import * as roleController       from '../../modules/administration/roles/roles.controller';
import { CreateRoleSchema, UpdateRoleSchema, AssignRoleSchema } from '../../modules/administration/roles/roles.dto';
import * as permController       from '../../modules/administration/permissions/permissions.controller';
import * as auditController      from '../../modules/administration/audit/audit.controller';
import * as groupController      from '../../modules/administration/groups/groups.controller';
import { CreateGroupSchema, UpdateGroupSchema, GroupMemberSchema } from '../../modules/administration/groups/groups.dto';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.get('/users/:id/permissions', (req, res, next) => {
  if (req.params.id === req.user!.userId) return next();
  return workspaceReadyMiddleware(req, res, next);
}, roleController.getUserPermissions);
router.use(workspaceReadyMiddleware);

router.get('/organization-settings', authorize('settings.view'), organizationSettings.get);
router.patch('/organization-settings', authorize('settings.edit'), validate(UpdateOrganizationSettingsSchema), organizationSettings.update);

// -- Users ---------------------------------------------
router.get(   '/users',                  authorize('users.view'),   userController.getAll);
router.get(   '/users/:id',              authorize('users.view'),   userController.getById);
router.post(  '/users',                  authorize('users.manage'), validate(CreateUsersSchema), userController.create);
router.put(   '/users/:id',              authorize('users.manage'), validate(UpdateUsersSchema), userController.update);
router.delete('/users/:id',              authorize('users.manage'), userController.deleteRecord);
router.patch( '/users/:id/archive',      authorize('users.manage'), userController.archive);
router.patch( '/users/:id/restore',      authorize('users.manage'), userController.restore);
router.post(  '/users/bulk-update',      authorize('users.manage'), userController.bulkUpdate);
router.post(  '/users/bulk-delete',      authorize('users.manage'), userController.bulkDelete);

router.post('/users/:id/password-reset', authorize('users.manage'), passwordResetRateLimiter, userController.sendPasswordReset);

// -- Roles (RoleDefinition) ----------------------------
router.get(   '/roles',                authorize('roles.manage'), roleController.getRoles);
router.get(   '/roles/:id',            authorize('roles.manage'), roleController.getRoleById);
router.post(  '/roles',                authorize('roles.manage'), validate(CreateRoleSchema), roleController.createRole);
router.put(   '/roles/:id',            authorize('roles.manage'), validate(UpdateRoleSchema), roleController.updateRole);
router.patch( '/roles/:id/archive',    authorize('roles.manage'), roleController.archiveRole);
router.post(  '/roles/assign',         authorize('roles.manage'), validate(AssignRoleSchema), roleController.assignRoleToUser);
router.delete('/roles/unassign',       authorize('roles.manage'), validate(AssignRoleSchema), roleController.removeRoleFromUser);

// -- Permissions (read-only reference for role builder) -
router.get(   '/permissions',          authorize('roles.manage'), permController.getPermissions);

// -- Audit Log -----------------------------------------
router.get(   '/audit',                authorize('audit.view'),   auditController.getAuditLogs);

// -- Groups ---------------------------------------------
router.get(   '/groups',                     authorize('users.manage'), groupController.getAll);
router.post(  '/groups',                     authorize('users.manage'), validate(CreateGroupSchema), groupController.create);
router.put(   '/groups/:id',                 authorize('users.manage'), validate(UpdateGroupSchema), groupController.update);
router.delete('/groups/:id',                 authorize('users.manage'), groupController.remove);
router.post(  '/groups/:id/members',         authorize('users.manage'), validate(GroupMemberSchema), groupController.addMember);
router.delete('/groups/:id/members/:userId', authorize('users.manage'), groupController.removeMember);


export default router;
