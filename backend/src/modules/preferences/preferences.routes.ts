import { Router } from 'express';
import { authMiddleware } from '../../api/middleware/auth.middleware';
import { tenantMiddleware } from '../../api/middleware/tenant.middleware';
import { authorize } from '../../api/middleware/rbac.middleware';
import { validate } from '../../api/middleware/validate.middleware';
import * as controller from './preferences.controller';
import { SaveColumnsBodySchema } from './preferences.dto';

const router = Router();

// All preference routes require authentication + tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── User Preferences ──────────────────────────────────────────────────────────
router.get('/:module', controller.getEffectiveColumns);
router.put('/:module', validate(SaveColumnsBodySchema), controller.saveUserPreference);
router.delete('/:module', controller.deleteUserPreference);

// ── Tenant Defaults (admin only — settings.edit permission) ───────────────────
router.put('/:module/tenant-default', authorize('settings.edit'), validate(SaveColumnsBodySchema), controller.saveTenantDefault);
router.delete('/:module/tenant-default', authorize('settings.edit'), controller.deleteTenantDefault);

export default router;
