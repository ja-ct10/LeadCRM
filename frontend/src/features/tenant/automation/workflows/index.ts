// Workflows module — barrel export
export { default as WorkflowsPage } from './WorkflowsPage';

// UI
export { WorkflowRecipesModal } from './ui/workflow-recipes-modal';
export { WorkflowExecutionLogModal } from './ui/workflow-execution-log-modal';
export { default as VisualWorkflowBuilder } from './ui/visual-workflow-builder';

// Hooks
export { useWorkflows } from './hooks/use-workflows';

// Services
export { workflowsService } from './services/workflows.service';
