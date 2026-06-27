import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';

import * as taskController         from '../../modules/operations/tasks/tasks.controller';
import * as serviceOrderController from '../../modules/operations/service-orders/service-orders.controller';

import { CreateTaskSchema, UpdateTaskSchema }       from '../../modules/operations/tasks/tasks.dto';
import { CreateServiceOrderSchema, UpdateServiceOrderSchema, CompleteServiceOrderSchema }
  from '../../modules/operations/service-orders/service-orders.dto';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Tasks ─────────────────────────────────────────────
// Note: tasks use deals.* permissions since they are tightly coupled to deals
router.get(   '/tasks',                 authorize('deals.view'),   taskController.getTasks);
router.get(   '/tasks/:id',             authorize('deals.view'),   taskController.getTaskById);
router.post(  '/tasks',                 authorize('deals.create'), validate(CreateTaskSchema), taskController.createTask);
router.put(   '/tasks/:id',             authorize('deals.edit'),   validate(UpdateTaskSchema), taskController.updateTask);
router.patch( '/tasks/:id/complete',    authorize('deals.edit'),   taskController.completeTask);
router.patch( '/tasks/:id/archive',     authorize('deals.delete'), taskController.archiveTask);

// ── Service Orders ────────────────────────────────────
router.get(   '/service-orders',          authorize('deals.view'),   serviceOrderController.getServiceOrders);
router.get(   '/service-orders/:id',      authorize('deals.view'),   serviceOrderController.getServiceOrderById);
router.post(  '/service-orders',          authorize('deals.create'), validate(CreateServiceOrderSchema), serviceOrderController.createServiceOrder);
router.put(   '/service-orders/:id',      authorize('deals.edit'),   validate(UpdateServiceOrderSchema), serviceOrderController.updateServiceOrder);
router.patch( '/service-orders/:id/complete', authorize('deals.edit'), validate(CompleteServiceOrderSchema), serviceOrderController.completeServiceOrder);

export default router;
