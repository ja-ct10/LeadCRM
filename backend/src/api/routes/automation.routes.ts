import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware, workspaceReadyMiddleware } from '../middleware/tenant.middleware';
import { authorize, authorizeAny, authorizeArchivedQuery } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import * as workflowController from '../../modules/automation/workflows/workflows.controller';
import * as actionController   from '../../modules/automation/actions/actions.controller';
import * as triggerController  from '../../modules/automation/triggers/triggers.controller';
import { CreateWorkflowSchema, ValidateWorkflowSchema, UpdateWorkflowSchema, TestWorkflowSchema, WorkflowStateSchema } from '../../modules/automation/workflows/workflows.dto';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(workspaceReadyMiddleware);
router.use(authorizeArchivedQuery);

// ── Workflows ─────────────────────────────────────────
router.get('/workflow-options', authorize('workflows.view'), workflowController.getOptions);
router.get('/workflow-name-availability', authorize('workflows.view'), workflowController.getWorkflowNameAvailability);
router.get(   '/workflows',                   authorize('workflows.view'),     workflowController.getWorkflows);
router.get(   '/workflows/:id',               authorize('workflows.view'),     workflowController.getWorkflowById);
router.put('/workflows/:id/draft', authorize('workflows.edit'), workflowController.saveDraft);
router.post('/workflows/:id/publish', authorize('workflows.edit'), authorize('workflows.activate'), workflowController.publishDraft);
router.get('/workflows/:id/versions', authorize('workflows.view'), workflowController.publications);
router.post('/workflows/:id/versions/:version/restore', authorize('workflows.edit'), workflowController.restorePublication);
router.post('/workflows/:id/duplicate', authorize('workflows.duplicate'), workflowController.duplicateWorkflow);
router.post(  '/workflows',                   authorize('workflows.create'),   validate(CreateWorkflowSchema), (req, res, next) => req.body.isActive ? authorize('workflows.activate')(req, res, next) : next(), workflowController.createWorkflow);
router.post('/workflows/validate', authorize('workflows.execute'), validate(ValidateWorkflowSchema), workflowController.validateDraft);
router.put('/workflows/:id', authorizeAny('workflows.edit', 'workflows.activate', 'workflows.pause'), validate(UpdateWorkflowSchema), workflowController.updateWorkflow);
router.patch('/workflows/:id/toggle', authorizeAny('workflows.activate', 'workflows.pause'), validate(WorkflowStateSchema), workflowController.toggleWorkflow);
router.patch( '/workflows/:id/archive',       authorize('workflows.delete'),   workflowController.archiveWorkflow);
router.get(   '/workflows/:id/executions',    authorize('workflows.view_runs'),     workflowController.getWorkflowExecutions);
router.get('/workflows/:id/executions/:executionId', authorize('workflows.view_runs'), workflowController.getExecution);
router.post(  '/workflows/:id/test',          authorize('workflows.execute'),  validate(TestWorkflowSchema), workflowController.testWorkflow);

// ── Builder reference data ────────────────────────────
router.get( '/actions',  authorize('workflows.view'), actionController.getActions);
router.get( '/triggers', authorize('workflows.view'), triggerController.getTriggers);

export default router;
