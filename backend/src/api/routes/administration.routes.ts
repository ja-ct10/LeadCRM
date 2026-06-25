import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import * as userController  from '../../modules/administration/users/users.controller';
import * as auditController from '../../modules/administration/audit/audit.controller';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Users ─────────────────────────────────────────────
router.get(   '/users',               authorize('users.view'),   userController.getUsers);
router.get(   '/users/:id',           authorize('users.view'),   userController.getUserById);
router.post(  '/users',               authorize('users.manage'), userController.createUser);
router.put(   '/users/:id',           authorize('users.manage'), userController.updateUser);
router.patch( '/users/:id/deactivate',authorize('users.manage'), userController.deactivateUser);

// ── Audit Log ─────────────────────────────────────────
router.get(   '/audit',               authorize('audit.view'),   auditController.getAuditLogs);

export default router;
