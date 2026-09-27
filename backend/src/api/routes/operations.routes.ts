import { ValidationError } from '../../shared/errors/http-error';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware, workspaceReadyMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';

import * as taskController         from '../../modules/operations/tasks/tasks.controller';

import { CreateTaskSchema, UpdateTaskSchema, TaskBulkSchema, TaskOptionsQuerySchema } from '../../modules/operations/tasks/tasks.dto';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(workspaceReadyMiddleware);

// -- Tasks ---------------------------------------------
// Note: tasks use deals.* permissions since they are tightly coupled to deals
router.get(   '/tasks',                 authorize('deals.view'),   taskController.getTasks);
router.get('/tasks/summary', authorize('deals.view'), taskController.getSummary);
router.get('/tasks/options', authorize('deals.view'), (req, res, next) => {
  const parsed = TaskOptionsQuerySchema.safeParse(req.query);
  if (!parsed.success) { next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid task options query.')); return; }
  const permission = parsed.data.kind === 'account' ? 'accounts.view' : ['lead', 'contact'].includes(parsed.data.kind) ? 'contacts.view' : 'deals.view';
  return authorize(permission)(req, res, next);
}, taskController.getOptions);
router.post('/tasks/bulk', validate(TaskBulkSchema), (req, res, next) =>
  authorize(req.body.operation === 'archive' ? 'deals.delete' : 'deals.edit')(req, res, next), taskController.bulkTasks);
router.get(   '/tasks/:id',             authorize('deals.view'),   taskController.getTaskById);
router.post(  '/tasks',                 authorize('deals.create'), validate(CreateTaskSchema), taskController.createTask);
router.put(   '/tasks/:id',             authorize('deals.edit'),   validate(UpdateTaskSchema), taskController.updateTask);
router.patch( '/tasks/:id/complete',    authorize('deals.edit'),   taskController.completeTask);
router.patch( '/tasks/:id/archive',     authorize('deals.delete'), taskController.archiveTask);

export default router;
