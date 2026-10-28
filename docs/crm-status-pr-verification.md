# CRM status consolidation

This contribution consolidates Deal isolation, verified reply transitions, protected manual statuses, phone editing, audience dropdowns and detail/Inbox presentation fixes onto the current upstream main. The form heading and import-column edits from the other worktrees are already present upstream in equivalent form and are preserved.

The only new database field is the nullable Deal manual-status checkpoint. Its migration is included in the existing guarded deployment plan. Source capture, mailbox synchronization, explicit customer workflows, confirmed-sale conversion and lifecycle completion remain in their existing services.

Local verification on the consolidated source includes route/Prisma type generation, TypeScript for shared/backend/frontend, backend test typechecking, documentation links and migration guard tests. GitHub performs the hosted checks after the PR opens. Operator manifests and hosted cleanup evidence are retained locally and are not part of this public contribution. Opening the PR performs no database operation or deployment.
