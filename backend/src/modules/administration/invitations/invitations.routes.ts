import { Router } from 'express';
import { authMiddleware } from '../../../api/middleware/auth.middleware';
import { authorize } from '../../../api/middleware/rbac.middleware';
import { Permission } from '../../../shared/constants/permissions';
import { registerRateLimiter } from '../../../api/middleware/rate-limit.middleware';
import * as invitationsController from './invitations.controller';

import { workspaceReadyMiddleware } from '../../../api/middleware/tenant.middleware';

const router = Router();

// GET /api/v1/invitations/validate/:token — PUBLIC, no auth required
// Rate-limited to prevent token enumeration. Must be registered before /:id routes.
router.get(
  '/validate/:token',
  registerRateLimiter,
  invitationsController.validateInvitation,
);

// POST /api/v1/invitations — create + send invitations (requires users.manage permission)
router.post(
  '/',
  authMiddleware,
  workspaceReadyMiddleware,
  authorize(Permission.USERS_MANAGE),
  registerRateLimiter,
  invitationsController.create,
);

// GET /api/v1/invitations — list pending invitations for tenant
router.get(
  '/',
  authMiddleware,
  workspaceReadyMiddleware,
  invitationsController.list,
);

// DELETE /api/v1/invitations/:id — revoke an invitation
router.delete(
  '/:id',
  authMiddleware,
  workspaceReadyMiddleware,
  authorize(Permission.USERS_MANAGE),
  invitationsController.revoke,
);

export default router;
