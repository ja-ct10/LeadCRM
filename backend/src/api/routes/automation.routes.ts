import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware, workspaceReadyMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import * as workflowController from '../../modules/automation/workflows/workflows.controller';
import * as actionController   from '../../modules/automation/actions/actions.controller';
import * as triggerController  from '../../modules/automation/triggers/triggers.controller';
import { CreateWorkflowSchema, UpdateWorkflowSchema, TestWorkflowSchema } from '../../modules/automation/workflows/workflows.dto';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(workspaceReadyMiddleware);

// ── Workflows ─────────────────────────────────────────
router.get(   '/workflows',                   authorize('workflows.view'),     workflowController.getWorkflows);
router.get(   '/workflows/:id',               authorize('workflows.view'),     workflowController.getWorkflowById);
router.post(  '/workflows',                   authorize('workflows.create'),   validate(CreateWorkflowSchema), (req, res, next) => req.body.isActive ? authorize('workflows.activate')(req, res, next) : next(), workflowController.createWorkflow);
router.put(   '/workflows/:id',               authorize('workflows.edit'),     validate(UpdateWorkflowSchema), (req, res, next) => req.body.isActive !== undefined ? authorize('workflows.activate')(req, res, next) : next(), workflowController.updateWorkflow);
router.patch( '/workflows/:id/toggle',        authorize('workflows.activate'), workflowController.toggleWorkflow);
router.patch( '/workflows/:id/archive',       authorize('workflows.delete'),   workflowController.archiveWorkflow);
router.get(   '/workflows/:id/executions',    authorize('workflows.view'),     workflowController.getWorkflowExecutions);
router.post(  '/workflows/:id/test',          authorize('workflows.view'),     validate(TestWorkflowSchema), workflowController.testWorkflow);

// ── Builder reference data ────────────────────────────
router.get( '/actions',  authorize('workflows.view'), actionController.getActions);
router.get( '/triggers', authorize('workflows.view'), triggerController.getTriggers);

export default router;
