ALTER TABLE "WorkflowExecutionRun" ADD COLUMN "dispatchContext" JSONB, ADD COLUMN "leaseId" TEXT, ADD COLUMN "leaseUntil" TIMESTAMP(3), ADD COLUMN "dispatchStartedAt" TIMESTAMP(3);
ALTER TABLE "WorkflowExecutionStep" ADD COLUMN "resolvedInput" JSONB;
CREATE INDEX "workflow_dispatch_queue" ON "WorkflowExecutionRun" ("status", "leaseUntil", "startedAt") WHERE "dispatchContext" IS NOT NULL;
