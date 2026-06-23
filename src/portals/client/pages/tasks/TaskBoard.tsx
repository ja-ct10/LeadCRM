/**
 * Migration shim — TaskBoard has moved to src/modules/tasks/pages/TaskBoard.tsx
 * This re-export preserves all existing imports (App.tsx, etc.) without change.
 * Remove this file once App.tsx is updated to import from the new location.
 */
export { default } from '../../../../modules/tasks/pages/TaskBoard';
