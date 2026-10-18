# Customer classification, assignment and workflow revisions

See [architecture](ARCHITECTURE.md), [API conventions](API.md) and the [deployment guidance](../README.md) for the existing module and deployment boundaries.

## Customer lifecycle

New Leads and Contacts default to Inquiry. Existing statuses are retained by the migrations. Genuine incoming replies warm Inquiry/Cold records; a current linked, nonarchived Qualified Deal makes a nonterminal customer Hot. Closed and Cancelled remain protected. Removing the final qualifying relationship reevaluates the remaining engagement evidence. The shared evaluator lives in `shared/src/contracts/customer-classification.ts`.

Unqualified historical/manual Hot records retain eight-day aging; verified reply/outreach evidence becomes Cold at 30 days. Untouched Inquiry records remain Inquiry. A bounded five-minute sweep evaluates up to 50 Leads and 50 Contacts per active workspace per pass, using an active Client Admin and durable cursors. Mailbox ingestion and qualification changes also evaluate immediately. Workspaces without an active Client Admin cannot run the independent sweep.

Use All Leads, My Leads (for staff) and Active Leads with the existing filters and table sorting. A logged staff call or a confirmed personal send establishes first outreach for classification. Scheduled messages, notes and campaigns do not. The migration backfills only explicit staff calls and confirmed personal mailbox send receipts.

Organization fields label the linked Account's address as Company Address; Additional Information labels the person's address as Lead Address. Both addresses retain their existing storage, validation and save behavior. Existing default address labels are clarified when rendering; customized Lead address labels are preserved.

New Lead assignment uses Inquiry=1, Warm=2, Hot=3, Cold=1 and terminal=0. Only current nonarchived, unconverted Leads count; automatically created Deals do not. Eligible agents with the minimum score rotate by stable ID. Existing permissions, Sales group rules for forms, explicit owners and transaction/retry guards remain in force. Workflow Lead-owner assignment additionally offers `weighted_workload`, using its existing availability and capacity settings. Assignment activities contain the method and chosen workload score.

## Products and Tasks

Products require one nonblank `category` (up to 200 characters) when creating or saving a Product; existing Product permissions apply. The integration reuses main's Product metadata column and description field. Blank/null API categories are rejected. Historical Products without a category remain intact and display as Uncategorized until a category is selected when editing. See [Product Category management](product-category-management.md) for the shared category source and mutation rules. Product IDs, descriptions, existing category labels and historical Deal values remain unchanged.

Task Deal options accept `accountId`, `category`, `productInterestId`, `search`, `page`, `limit` and `selectAll`. Category uses `__uncategorized` for products without a category. Filters intersect; the server checks permissions and tenant scope. Paginated responses return `data` and `meta` including the total. `selectAll=true` returns all matching authorized IDs up to 50; 51 matches returns a validation error. The UI also checks the union with prior selections. Saving validates all selected associations in one transaction and creates one Task.

## Workflow API

| Action | Endpoint | Required permission |
| --- | --- | --- |
| Save shared draft | `PUT /automation/workflows/:id/draft` | Workflows Edit |
| Publish revision | `POST /automation/workflows/:id/publish` | Workflows Edit and Activate |
| Read publications | `GET /automation/workflows/:id/versions` | Workflows View |
| Restore into draft | `POST /automation/workflows/:id/versions/:version/restore` | Workflows Edit |

Writes carry `expectedVersion` and `expectedDraftRevision`; save/publish also carry `draft`. Conflicts return 409. Saving a draft changes neither the published definition nor activation identity. Publishing validates references and current permissions before an atomic revision switch. Restore produces a draft; it requires publication to affect new events. Existing preview accepts `useDraft: true`. Pause remains explicit.

Queued/running executions retain their definition snapshot and activating identity; current pause, archive, permission, lease and record checks still apply. The additive migration snapshots the one current published definition of active/paused workflows, retaining its version number. It does not fabricate earlier revisions.

Date labels are field-aware while saved operator keys and comparison semantics remain unchanged. Lead Created date boundaries continue to use Manila calendar days.

## Incoming SMS setup

Configure `TEXTBEE_WEBHOOK_SECRET` for the existing signed webhook and `TEXTBEE_API_KEY` for history reconciliation. Set `TEXTBEE_RECEIVER_ROUTES` to a JSON array of objects containing `deviceId`, `tenantId` and `userId`. Each provider device must map to exactly one workspace; the integration owner must be active and authorized to edit the matched customer. Routing comes from trusted server configuration, never a received tenant identifier or phone number.

Enable Receive SMS and Android SMS permission on each device, then subscribe the webhook to `MESSAGE_RECEIVED`. TextBee documents both incoming events and received-message history in its [receiving guide](https://textbee.dev/docs/receiving-sms). The worker checks history every five minutes with durable pagination and a 30-day overlap; late uploads outside that window require an operator history backfill.

Receipts deduplicate by provider device/message ID. Phone numbers normalize before matching. Multiple matches, missing customers or unavailable owners enter review without warming anyone. Client Admins can inspect and retry tenant-scoped reviews in Campaigns after resolving the reason. Unmapped devices are retained without tenant attribution; correct server routing and replay the authenticated event or reconcile provider history to attribute them safely. Automated/control messages are ignored. Review records contain message text; retain and protect them as customer communications.

## Rollout and verification

Apply `20261217000000_inquiry_status` first, committing the new Contact enum value before `20261218000000_crm_classification_and_revisions` uses it. Both migrations are in the existing guarded deployment allowlist. Deploy the coordinated backend, frontend and shared build after the additive schema, then configure receiving routes. Existing statuses, prices and execution history remain intact. Do not enable the new application against the old schema.

The integrated migration preserves main's already-created category column. A database that previously applied the standalone feature-branch version of the classification migration needs a reviewed migration-history reconciliation before this integrated release; the deployment guard intentionally rejects a changed applied checksum. Do not overwrite migration receipts. The existing local preview can continue using its original feature-branch checkout and database.

Run `node backend/scripts/test-crm-merge-disposable.mjs` for a populated current-main upgrade and combined classification, company-name, quotation and Task acceptance checks on disposable PostgreSQL.

Use the repository's isolated QA commands. Focused SQL acceptance is `npm run test:integration:native -- --filter=classification.integration.test.ts`; it includes a populated guarded migration/startup rehearsal. The fixture uses disposable PostgreSQL and strips real provider credentials. Source/UI unit tests cover lifecycle boundaries, date wording, categories and paginated selection; workspace type checks and production builds are required before release. Live mailbox/SMS delivery still needs a configured device/account acceptance check by the operator.
