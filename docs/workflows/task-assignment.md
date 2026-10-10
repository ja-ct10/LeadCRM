# Task assignment and creator history

Tasks use ordered `TaskLead`, `TaskContact`, `TaskDeal` and `TaskAccount` links. Singular association IDs are compatibility projections of those links. The authenticated endpoints and permission keys are documented in [API](../API.md#task-endpoints).

Task Owner (Created by) is the original validated creating actor in nullable `Task.createdById`. Manual creation, record-context creation and Workflow actions all use the shared Task service. Clients cannot submit or edit `createdById`; a same-tenant composite foreign key and an immutable-creator database trigger protect persisted ownership. Historical Tasks without unambiguous same-tenant `task.created` audit evidence display **Not recorded**. The forward migration does not infer a creator from the assignee or latest assigning user.

Assigned Agent remains `assignedUserId`, the current responsible worker. `assignedById` records the most recent assignment actor. Reassignment, completion, bulk operations and deactivation transfers preserve the original creator. Existing saved column preferences retain the `assignedUser` column ID; only its label changes to Assigned Agent. Task Owner is a separate display column, without a new creator filter or transfer operation.

Converted Contact Task reads include direct Contact links and Tasks linked to same-tenant Leads whose `contactId` matches and `convertedAt` is present. Lists, counts and Related Tasks use the same contextual predicate and deduplicate by the original Task ID. The original Task, creator, assignee, timestamps, files and links are retained. An inherited Task has no synthetic direct Contact link. Merge operations use a separate direct-link predicate and never move inherited links.

Task state remains `pending`, `in_progress`, `blocked`, `completed` or `cancelled`; completion stores its actor and timestamp. Calendar input continues to use the shared Asia/Manila conversion. Reopening clears completion metadata without changing creator history.

Apply `20261121000000_task_creator_sales_group` after the earlier forward migrations, then regenerate Prisma and build the shared package. The migration also provisions the protected default Sales group, described in [Forms](../forms-production-report.md).

Focused verification covers spoofed creator rejection, A-created/B-assigned attribution, reassignment preserving A, audit-only migration backfill, converted Lead Task visibility/deduplication and direct-only merge reassignment. Workflow assignment policies remain documented in [Workflow assignment/history](workflow-assignment-history.md).
