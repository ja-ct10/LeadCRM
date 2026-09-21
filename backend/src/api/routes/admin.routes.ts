import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { systemAdminMiddleware } from '../middleware/system-admin.middleware';
import * as auditController from '../../modules/administration/audit/audit.controller';
import * as tenantController from '../../modules/system-admin/tenants/tenants.controller';
import { validate } from '../middleware/validate.middleware';
import { CreateTenantSchema } from '../../modules/system-admin/tenants/tenants.dto';

const router = Router();

// ── All admin routes require auth + System Admin role ─────────────────────────
router.use(authMiddleware);
router.use(systemAdminMiddleware);

// ── Tenant Management ───────────────────────────────────────────────────────
router.get('/tenants', tenantController.list);
router.post('/tenants', validate(CreateTenantSchema), tenantController.create);
router.patch('/tenants/:id/deactivate', tenantController.deactivate);
router.patch('/tenants/:id/activate', tenantController.activate);

router.get('/audit-logs', auditController.getAuditLogs);
export default router;
