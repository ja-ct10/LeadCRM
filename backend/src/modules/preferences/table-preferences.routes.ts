import { Router } from 'express';
import { authMiddleware } from '../../api/middleware/auth.middleware';
import { tenantMiddleware } from '../../api/middleware/tenant.middleware';
import * as controller from './table-preferences.controller';

const router = Router();

// All table preference routes require authentication + tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Table Preferences (per-user, per-module) ──────────────────────────────────
router.get('/:module', controller.getTablePreferences);
router.put('/:module/page-size', controller.savePageSize);
router.put('/:module/view-mode', controller.saveViewMode);
router.put('/:module/sort', controller.saveSort);
router.get('/:module/view-type', controller.getViewType);
router.put('/:module/view-type', controller.saveViewType);
router.put('/:module/filters', controller.saveFilters);

export default router;
