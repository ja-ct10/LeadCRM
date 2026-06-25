import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import * as workflowController from '../../modules/automation/workflows/workflows.controller';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get(   '/workflows',                   authorize('workflows.view'),     workflowController.getWorkflows);
router.get(   '/workflows/:id',               authorize('workflows.view'),     workflowController.getWorkflowById);
router.post(  '/workflows',                   authorize('workflows.create'),   workflowController.createWorkflow);
router.put(   '/workflows/:id',               authorize('workflows.edit'),     workflowController.updateWorkflow);
router.patch( '/workflows/:id/toggle',        authorize('workflows.activate'), workflowController.toggleWorkflow);
router.patch( '/workflows/:id/archive',       authorize('workflows.delete'),   workflowController.archiveWorkflow);
router.get(   '/workflows/:id/executions',    authorize('workflows.view'),     workflowController.getWorkflowExecutions);

export default router;
