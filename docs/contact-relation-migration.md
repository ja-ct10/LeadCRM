# Lead and Contact relation repair

`leadId` references `Lead`; `contactId` references `Contact`. There is no separate Customer entity. Customer classification fields such as `customerType` and unrelated billing identifiers keep their existing meaning.

## Observed failure

The deployed Send Now request returned Prisma `P2011`. A read-only inspection found `CampaignContact.contactId` still `NOT NULL`, alongside `customerId`. The application wrote `customerId`, so inserting recipient snapshots failed before any email submission. The affected campaign was still DRAFT with zero recipients and sends.

Other deployed foreign keys still referenced the retired Customer table. Both `Customer` and `CustomerDeal` were empty. The preflight found no conflicting, missing, or cross-scope contact references across the seven affected tables. These checks describe the inspected state; the migration repeats validation under locks.

## Implementation

- Rename Prisma/application foreign keys to `contactId` in Deal, Task, Activity, CampaignContact, Invoice, EmailDeliveryLog, and SMSQueue. Update campaigns, automation, relationships, merge operations, seed data, and frontend contracts/adapters together.
- Migration `20261005000000_contact_relation_names` handles databases with only `customerId` or both names. It preserves existing contact links, makes the Contact reference optional for lead-only rows, and rebuilds Contact foreign keys and indexes.
- Drop the empty `CustomerDeal` and `Customer` tables without CASCADE. Nonempty legacy tables, conflicting links, out-of-scope links, unexpected dependents, or duplicate campaign recipients stop the migration and roll back the transaction. No records are silently discarded.
- Resolve campaign audiences through the existing transaction client. This avoids exhausting the database pool while the sending transaction is holding its connection.

Historical migrations remain unchanged. The new migration is the only pending migration found by the production preflight.

## Coordinated rollout

This is a database/API contract change. Do not run the migration while an old backend or worker is serving requests: its Prisma client still expects `customerId`.

1. Build this revision and retain a database backup/recovery point. Confirm no campaigns are actively sending; never reset ambiguous SENDING campaigns to DRAFT.
2. Drain/stop old backend and worker processes during a maintenance window.
3. With the deployed backend database configured, run `npm --prefix backend run db:deploy`.
4. Start the updated backend and deploy the corresponding frontend. Check Contacts, contact-linked activities/tasks/deals, audience preview, and campaign draft retrieval.
5. Verify a send only with explicitly approved test recipients, then confirm delivery events through the existing Brevo webhook.

If migration validation fails, its changes roll back. Resolve the reported data conflict before retrying; do not bypass the checks. After a successful migration, rolling back application code alone is unsafe because the old column names have been removed.

## Verification

- 73 backend tests passed: 61 campaign, email, workflow-unit, migration-ordering and migration-regression checks; 12 workflow HTTP/database acceptance checks in a separate disposable database.
- The campaign acceptance suite runs with one database connection and verifies persisted `leadId`/`contactId` snapshots, HTTP 202 completion, duplicate-send protection, quota rollback, tenant/environment access checks, Sandbox allowlisting, and webhook processing. Provider sends are mocked.
- Five migration regression cases cover both schema layouts, repeat execution, lead-only rows, preservation of contact links, nonempty legacy tables, conflicting references, and cross-tenant references.
- 31 frontend tests passed across campaign composer/data and deal adapter suites.
- All 58 migrations applied successfully to a fresh local database. Workspace TypeScript checks and the backend production build passed.

The production database has only been inspected. This migration and the updated application have not yet been deployed; no live campaign emails were sent during verification.
