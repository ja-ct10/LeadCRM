# Product Category, staff-phone validation and notification verification

Date: 28 October 2026, Asia/Manila. Local implementation only; no production database writes, migration, deployment or provider sends.

## Root causes and resulting behavior

1. Product category was already stored on ProductInterest, but CRM product projections exposed only IDs and names. Detail fields therefore could not reliably show categories, particularly for inactive products or a retired name reused by another product. Existing canonical relationships now expose read-only `productInterestRecords: { id, name, category }[]`. Lead/Contact Status & Interest and Deal Information render Product Category immediately above Product Interest. Edit selections update the derived display. Categories are distinct in selection order; known blank categories show `Uncategorized`, unresolved/empty selections show `—`. Category follows the existing product field's visibility and grouping. No new persisted field, product endpoint or migration was added.
2. Lead and Contact phone state was outside the form resolver; server phone errors were mapped but not shown by the phone control. Contacts accepted arbitrary phone text at the API boundary. No staff-phone identity check existed. Both forms and the Contact API now reuse LeadPhoneSchema and existing Philippine mobile input/storage conventions. A shared assertion compares against all same-tenant User phones, including inactive staff and employees hidden from directory/archive permissions. It uses the existing non-truncating comparison normalizer. Prisma reads are awaited inside the tenant-authoritative evidence context; returning a lazy Prisma query would lose that context and miss hidden staff.
3. Notification access depended on the caller's AsyncLocalStorage context. A disposable probe before the fix returned `eligible: true` and delivered a Cold Lead notification to an Active-view-only custom user in a worker, while GET resolution returned no destination; mutation-context resolution again allowed it. Shared notification access now enters a fresh recipient CRM-read context for deferred destination and eligibility reads. It explicitly requires an available CRM View scope. Existing permission helpers supply the actual record predicates, independently of the producer's actor, request method or worker. A protected Client Admin identity without current admin membership cannot fall through to staff eligibility. Retired Account assignment is explicitly ineligible rather than querying its retired ownership field.

Staff-phone errors appear immediately below the field, including inline edits, with this exact text:

> This phone number belongs to a staff account and cannot be used.

The authenticated phone preflight is `GET /api/v1/crm/phone-availability?module=leads|contacts&phone=…`. It follows existing email availability's response envelope and returns only availability, never staff identity. It requires that module's create or edit permission, uses no-store responses, and shares its assertion with actual transactional writes. The client uses the existing 600 ms debounce pattern, rejects stale responses, retries failed checks on blur, and blocks nonempty unverified numbers. Empty optional values skip the lookup. Email validation is unchanged.

Actual creation/update transactions recheck the resulting phone even when an edit omits it. Shared import, merge and conversion identity paths also enforce staff-phone exclusion. Existing create receipts remain idempotent. Existing staff accounts and CRM records are not rewritten or backfilled.

## Notification checklist: all 37 registered types

Source of truth: [current notification policy](../notifications-final-policy.md), shared NotificationTypes, notification-policy.ts, the current transactional SQL producers, and producer services. The 20 October administrative policy supersedes the older operational administrator matrix.

All rows below were traced through producer → outbox → dispatcher → current recipient access → preferences → transactional delivery ledger → feed/destination → counts/read/delete APIs → shared frontend watcher. The catalog integration suite separately exercises all 37 registered types against owner, other staff, Client Admin, denied, inactive and foreign recipients, repeats delivery, and verifies read/delete/replay behavior for deliveries. For eligible types it also checks disabled optional preferences versus mandatory delivery. Suppressed entries assert zero new delivery.

Legend:

- **O:** optional `inAppGeneral`; current active same-tenant staff owner/assignee or permitted sender plus current module and record access. Ordinary self-assignment is suppressed.
- **M:** mandatory existing alert; current active same-tenant eligible recipient. Module/ownership and incident checks still apply.
- **A:** current active same-tenant Client Admin with its protected role membership. Operational CRM alerts never broadcast to Client Admin, including admin-owned mailboxes/campaigns.
- **H:** retained registration/history, with no prospective delivery under current policy. Existing rows retain identity/read state; current access controls presentation and destinations.

| Checked type | Existing producer and event identity | Current recipient / preference | Destination |
| --- | --- | --- | --- |
| [x] `lead_assigned` | Lead insert/real assignee transition; `lead:created:<id>` or `assignment:<uuid>` | Current assignee, O | Lead; converted Lead resolves to authorized Contact |
| [x] `contact_assigned` | Contact insert/real assignee transition; create/assignment identity | Current assignee, O | Contact |
| [x] `account_assigned` | Historical producer registration; Account ownership retired | H; no new recipient | Authorized historical Account |
| [x] `deal_assigned` | Deal insert/real assignee transition; create/assignment identity | Current assignee, O | Deal |
| [x] `task_assigned` | Task insert/real assignee transition; create/assignment identity | Current assignee, O | Taskboard task |
| [x] `customer_hot` | Lead/Contact status transition; `status:<uuid>` | Current customer assignee, O | Lead/Contact |
| [x] `customer_cold` | Lead/Contact status transition; `status:<uuid>` | Current customer assignee with applicable View tab, O | Lead/Contact |
| [x] `customer_cancelled` | Lead/Contact status transition; `status:<uuid>` | Current customer assignee with applicable View tab, O | Lead/Contact |
| [x] `deal_progressed` | Historical registration; current stage producer does not emit it | H | Authorized historical Deal |
| [x] `deal_won` | Successful DealStageHistory transition; `deal-stage:<historyId>` | Current Deal assignee, O; committed amount/name snapshot | Deal |
| [x] `deal_lost` | Successful DealStageHistory transition; `deal-stage:<historyId>` | Current Deal assignee, O | Deal |
| [x] `closing_requirements_needed` | Qualified stage entry; `closing-needed:<historyId>` | Current Deal assignee, O; still Qualified with missing required values | Deal closing requirements |
| [x] `closing_requirements_completed` | Historical registration; current stage producer omits it | H | Authorized historical Deal |
| [x] `task_due` | Task scheduling trigger; task/date/assignee/version identity | Current Task assignee, O; configured reminder or 24-hour fallback, current version | Taskboard task |
| [x] `task_overdue` | Task scheduling trigger; independent overdue/date/assignee/version identity | Current Task assignee, O; due and incomplete/current version | Taskboard task |
| [x] `customer_reply` | Authorized new inbound MailboxMessage; RFC-message/account-provider identity plus assignee | Current linked customer assignee in own authorized private mailbox, O | Inbox thread |
| [x] `campaign_failed` | Campaign failure or interrupted/scheduled-failure AuditLog; campaign/run version identity | Authorized staff creator, O | Campaign |
| [x] `workflow_failed` | WorkflowExecutionRun failed transition; `workflow-failed:<runId>` | Existing producer, currently suppressed for every role; H | History retained; unavailable to staff and hidden from A |
| [x] `user_created` | User insert; `user:created:<id>` | A, M; employee-approval validation | Settings Users |
| [x] `user_status_changed` | User status transition or permanent login lock; status UUID or security audit identity | A, M; lock timestamp rechecked against current incident | Settings Users |
| [x] `mailbox_disconnected` | EmailAccount incident trigger; account/incident/inactive identity | Authorized staff mailbox owner, M; still disconnected | Inbox |
| [x] `mailbox_sync_failed` | EmailAccount incident trigger; account/incident/active identity | Authorized staff mailbox owner, M; persistent error for at least 15 minutes | Inbox |
| [x] `form_processing_failed` | Unexpected Form processing failure AuditLog; `audit:<id>` | Existing producer, currently suppressed for every role; H | History retained; unavailable to staff and hidden from A |
| [x] `record_archived` | Historical registration; current operations producer omits routine archive events | H | Current authorized historical target, otherwise redacted |
| [x] `record_restored` | Historical registration; current operations producer omits routine restore events | H | Current authorized historical target, otherwise redacted |
| [x] `website_lead` | Published Form creates a new Lead in its transaction; `website-lead:<leadId>` | Existing provenance event, currently suppressed for every role; separate assignee event retained | Historical authorized Lead |
| [x] `role_created` | Custom RoleDefinition insert; `role-created:<roleId>` | A, M; initial grants folded into this event | Settings Roles |
| [x] `role_archived` | Custom RoleDefinition archive; `role-archived:<uuid>` | A, M | Settings Roles |
| [x] `role_permissions_changed` | Coalesced RolePermission before/after transaction; role/transaction identity | A, M; unchanged replacement consumed without alert | Settings Roles |
| [x] `user_role_changed` | Coalesced UserRole before/after transaction; user/transaction identity | A, M; initial assignment folded into user creation | Settings Users |
| [x] `password_expiring_soon` | User password-change trigger; user/password-change identity, available on day 89 | Own active eligible staff or A only, M; stale password cycles suppressed | Own Profile / Change Password |
| [x] `sms_campaign_sent` | Existing SMS evidence/outcome service; campaign/run/`sent` identity, ordered sequence | Authorized staff creator/submitting sender, O | Campaign |
| [x] `sms_campaign_delivered` | Same evidence service; campaign/run/`delivered` identity | Authorized staff creator/submitting sender, O | Campaign |
| [x] `sms_campaign_failed` | Same evidence service; campaign/run/`failed` identity | Authorized staff creator/submitting sender, O | Campaign |
| [x] `sms_campaign_partial` | Same evidence service; campaign/run/`partial` identity | Authorized staff creator/submitting sender, O | Campaign |
| [x] `sms_campaign_unconfirmed` | Same evidence service; campaign/run/`unconfirmed` identity | Authorized staff creator/submitting sender, O; uncertain sends not replayed | Campaign |
| [x] `sms_campaign_progress` | Same evidence service; campaign/run/`progress` identity | Authorized staff creator/submitting sender, O | Campaign |

No new notification types, permissions, dependencies, worker, queue, endpoint, migration, or delivery channel were introduced for notifications. Group membership still does not grant CRM access. Current role grants, record ownership, tenant availability, employee eligibility, private mailbox access, source freshness and existing preferences remain authoritative.

Historical unavailable notices remain redacted/manageable as before; their unread bell count is distinct from accessible record/module dots. Client Admin's excluded operational history stays hidden before feed pagination, totals and mutations. Marking one record read uses existing record/cutoff semantics; unrelated records, recipients and newer notices remain unread.

### Other existing notification channels audited

- **Form submission email:** existing saved `notificationEmail` sends a generic submission notice after the CRM transaction commits. `notificationStatus` records sent/failed; the saved submission receipt prevents duplicate retries, and provider failure cannot roll back accepted CRM data. The Forms integration suite simulates provider failure. This is separate from the suppressed `form_processing_failed` bell event.
- **Password-recovery email:** existing recovery service reserves a hashed one-use token transactionally, applies eligibility/cooldown checks and calls the existing sender after commit. Definite rejection removes the failed token; uncertain delivery retains `UNCONFIRMED` and blocks automatic resends. Recovery integration tests simulate submission, rejection, uncertainty and concurrent requests. This is separate from the personal `password_expiring_soon` bell event.

## Phone and category scenarios

- Lead and Contact create/edit: valid local/canonical numbers, wrong prefix, incomplete/overlong/nonnumeric values, optional empty, unchanged non-conflicting edits, and clearing a number.
- Staff comparison: active or inactive same-tenant employees, directory-hidden staff, canonical/local/`09…`/separated stored representations, unrelated foreign-tenant staff, and overlong stored values that must not be truncated into a match.
- Preflight: module edit-only permission accepted; no module grant denied; only availability exposed. Client errors appear below the phone input with accessible error references.
- Late conflict after a successful preflight: actual create/edit rejected with phone field errors; nested Account creation and conversion leave no partial writes. Imports and merges reject staff phones; failed merge does not archive the secondary record.
- Client timing: current-number confirmation, 600 ms change debounce, stale-response exclusion, identity changes, failed-lookup retry, optional-empty/no request, save-time conflict and correction. Both Lead and Contact create/edit plus inline edits are covered.
- Categories: canonical IDs, multiple distinct categories, shared category deduplication, blank/unknown/empty values, inactive products with reused names, draft selection changes, configured field placement and all three detail panels. Derived metadata is excluded from record-change event comparisons.

## Changed files

Paths below are repository-relative. Unrelated pre-existing Inbox/proxy/reporting/duplicate-check changes are excluded.

| Files | Change |
| --- | --- |
| `backend/src/core/tenant/product-projections.ts` | Select category through canonical product relationships and expose read-only selected-product metadata. |
| `backend/src/modules/crm/leads/lead-serializer.ts` | Include product metadata in the explicit public Lead projection. |
| `shared/src/contracts/product-interests.contract.ts`, `shared/src/contracts/lead-read.contract.ts` | Define product summary type and Lead response field. |
| `shared/src/types/contact.types.ts`, `shared/src/types/deal.types.ts`, `frontend/src/store/types/lead.types.ts` | Carry the read-only product metadata through domain types. |
| `frontend/src/lib/api/adapters/lead.adapter.ts`, `contact.adapter.ts`, `deal.adapter.ts` | Preserve metadata when adapting existing responses. |
| `frontend/src/shared/components/crm/product-category-value.tsx` | Derive/display distinct selected categories with existing fallbacks. |
| `frontend/src/shared/components/crm/crm-record-view.tsx` | Attach derived category to the existing product row; use the phone inline editor. |
| `frontend/src/shared/components/crm/inline-edit-rows.tsx` | Render category before products, track current catalog/draft selection, and permit validation-aware custom phone actions. |
| `frontend/src/shared/components/crm/product-interest-select.tsx` | Allow its existing catalog hook to notify the parent about edit-time category metadata. |
| `frontend/src/features/tenant/crm/leads/ui/lead-form.tsx`, `contacts/ui/contact-form.tsx` | Show derived categories and phone field errors; block unverified/conflicting numbers in create/edit; preserve drafts. |
| `frontend/src/features/tenant/crm/deals/ui/deal-form.tsx` | Show derived category above product selection in Deal Information. |
| `frontend/src/features/tenant/crm/contacts/schemas/contact-form.schema.ts` | Reuse existing Lead phone schema in both Contact form modes. |
| `shared/src/contracts/phone-availability.ts`, generated `.js` | Shared query/result contract and exact conflict message. |
| `shared/src/index.ts`, generated `.js` | Export the phone availability contract through existing entry points. |
| `backend/src/api/routes/crm.routes.ts`, `backend/src/modules/crm/phone-availability.controller.ts` | Authenticated, authorized, no-store phone preflight using the shared assertion. |
| `backend/src/modules/crm/record-validation.ts` | Tenant-authoritative, non-truncating staff-phone comparison without employee disclosure. |
| `backend/src/modules/crm/contacts-v2/contacts-v2.dto.ts` | Reject malformed Contact API phones using the existing shared schema. |
| `backend/src/modules/crm/contacts/contacts.repository.ts`, `contacts-v2/contacts-v2.repository.ts` | Recheck resulting phones inside existing Lead and Contact update transactions. |
| `backend/src/modules/crm/leads/lead-automation.service.ts`, `contacts-v2/contact-creation.ts` | Enforce the restriction in shared creation paths. |
| `backend/src/modules/crm/leads/lead-conversion.service.ts`, `imports/import-rows.service.ts`, `merge/merge.service.ts` | Apply the same identity restriction to existing conversion/import/merge paths. |
| `backend/src/modules/crm/record-updates.ts` | Treat derived product metadata as loaded projection, not a material record edit. |
| `backend/src/modules/notifications/notification-access.ts` | Evaluate current recipient visibility consistently in worker/GET/mutation contexts; reject retired Account assignments and obsolete administrative membership. |
| `backend/src/modules/notifications/notification-policy.integration.test.ts` | Give Sales-template fixtures the actual existing CRM View tab required for their intended scenario; application roles/grants are unchanged. |
| `frontend/src/shared/hooks/use-phone-availability.ts` | Current-draft phone preflight, debounce, stale response handling, retry and save-time rejection. |
| `frontend/src/shared/components/crm/phone-inline-editor.tsx` | Reuse PhilippinePhoneInput and phone preflight for inline Save/Cancel. |
| `backend/src/modules/crm/phone-category.integration.test.ts` | Database/HTTP staff-phone, write rollback, import/merge/conversion and category identity coverage. |
| `backend/src/modules/notifications/notification-catalog.integration.test.ts` | All 37 registered types, recipient matrix, optional/mandatory preferences, read/delete/replay and context regression. |
| `frontend/src/shared/hooks/use-phone-availability.test.tsx` | Phone availability timing, failures, conflicts and isolation. |
| `frontend/src/shared/components/crm/__tests__/phone-inline-editor.test.tsx`, `product-category-value.test.tsx` | Inline phone rejection/correction and derived category/draft behavior. |
| `frontend/src/shared/components/crm/__tests__/crm-form-drafts.test.tsx`, `panel-migrations.test.tsx` | Exact phone errors across form modes and category position in existing forms/panels. |
| This report | Policy checklist, implementation explanation, test evidence and limits. |

## Executed checks and limitations

The following are completed runs, not inferred results. Combined counts are **366 distinct backend cases in 12 suites** and **395 frontend cases in 17 suites** across the completed invocations below. The full unfiltered repository test suite was not run. Evidence logs are ignored local files under `data/outputs/`.

| Executed selection | Result | Local evidence log |
| --- | --- | --- |
| `node backend/scripts/test-notifications-postgres.mjs` with catalog, policy, delivery, assignment and HTTP notification suites | 38 + 30 + 17 + 13 + 5 = **103 passed**. Catalog includes every registered type and preference classification. Delivery suite includes simultaneous workers, expired leases, transactional failure/retry, source freshness and deletion identity. | `notifications-final-verification.log` |
| Same native harness: CRM phone/category suite | **18 passed**. Includes editor-only preflight, hidden/inactive staff, late conflicts, rollback, malformed create/edit, import/merge/conversion, and inactive-product metadata available to custom CRM readers without Product View. | `crm-phone-category-verified.log` |
| Same native harness: existing SMS tracking, Forms, password expiration and scoped mailbox suites | **24 + 41 + 5 + 159 = 229 passed**. The earlier catalog fixture failure in this invocation is excluded; its repaired 38 cases are counted above. | `phone-category-notifications-provider-regressions.log` |
| Native security fixture: four selected login-lockout/password-warning cases; password-recovery suite | **4 + 12 = 16 passed**. The security selection intentionally skips its 28 other mixed cases; no full 32-case security result is claimed. | `notification-security-verified.log` |
| `npm --prefix frontend run test --` notification UI/hooks and Settings notification suites | **85 passed in 9 files**. Bell/list, record reads/dots, Settings tabs, stale state, preferences and SMS toasts. | `notifications-ui-verified.log` |
| Frontend phone hook, inline editor, category value, Lead form and Contact save suites | **20 passed in 5 files**. | `phone-category-ui-final.log` |
| Frontend CRM form draft suite | **27 passed**. Includes exact staff-phone messages for Lead/Contact create/edit, correction and category ordering. | `phone-forms-isolated.log` |
| Frontend Deal form suite | **25 passed**. | `category-deal-form-verified.log` |
| Full frontend shared detail-panel suite | **238 passed**. Includes category order for all three panels plus existing editing, relationship, field layout, files and permissions cases. | `category-panels-full-regression.log` |
| `npm run lint` | **Passed all 3 workspaces**, including backend source and test TypeScript checks; shared result cached. | `phone-category-workspace-lint-final.log` |
| `npm run build` with command-local `API_URL=https://build.invalid/api/v1` | **Passed all 3 workspaces**; shared compatibility JavaScript synchronized, Prisma generated, backend compiled, frontend production build generated 180 pages. Shared result cached on the final invocation. The non-routable URL satisfies build configuration only; it is not saved as deployment configuration. | `phone-category-build-complete.log` |
| `git diff --check` | **Passed**; Git emitted only line-ending normalization warnings. | Tool output |

Earlier diagnostic failures were retained rather than represented as passing runs: sandbox loopback/file-cache restrictions, missing build API_URL, sandbox Google Fonts DNS failure, incomplete new test fixtures, and asynchronous UI assertions. The hidden-staff failure identified and corrected the lazy-Prisma-context issue. Two Sales-template notification fixtures lacked a current CRM View tab and were corrected to reflect their intended existing access. Incomplete fixtures/assertions were repaired and their suites rerun. Broad UI runs interrupted during diagnosis do not count as completed green runs.

Local native PostgreSQL tests use fresh disposable databases and the repository's provider/network guards. Provider results are simulated; no live Gmail, SMS, Form-email or password-recovery send was performed. No deployed delivery, production database contents, sustained production performance or browser-provider acceptance is claimed. UI component tests establish DOM/interaction behavior; they are not screenshots or a full live browser acceptance run.
