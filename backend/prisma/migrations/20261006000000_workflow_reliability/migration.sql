-- Additive migration: preserve definitions, histories and existing paused state.
BEGIN;
ALTER TABLE "Workflow" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Workflow" ADD COLUMN "activatedById" TEXT;
UPDATE "Workflow" SET "status" = 'PAUSED', "isActive" = false;
-- Existing definitions must be explicitly reactivated by an authorized user.
ALTER TABLE "WorkflowTriggerRecord" ADD COLUMN "eventId" TEXT;
CREATE UNIQUE INDEX "workflow_event_once"
  ON "WorkflowTriggerRecord"("tenantId", "environment", "workflowId", "eventId");
COMMIT;
