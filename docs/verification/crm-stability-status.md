# CRM stability and status editing verification

Inspected `main` at `3ed0773d`, then reconciled the implementation with `origin/main` at `910fe6fa`. Delivery branch: `codex/crm-stability-status`. The three existing presentation documents were left untouched and excluded from the commit.

## Root causes and fixes

| Issue | Actual cause | Fix and location |
| --- | --- | --- |
| Task editors closed or lost drafts during unrelated updates | CRM content revisions hard-evicted Tasks, incrementing the authorization scope used as editor identity. A whole tenant object dependency also repeated reads for an unchanged tenant. | [DataContext](../../frontend/src/store/DataContext.tsx#L713) now invalidates content softly. [useTasks](../../frontend/src/features/tenant/operations/tasks/use-tasks.ts#L19) retains rows, summaries and scope during replacement reads and depends on the tenant ID. Auth, tenant, permission and Group scope changes retain hard clearing. |
| Repeated reads and visible refresh indicators | SSE reconnects reset remembered revisions, so unchanged snapshots refetched. CRM lists, profiles and the Deal board also polled over the revision streams. Background fetch flags drove visible refresh UI. | Retain revisions across reconnects; remove overlapping CRM intervals; retain focus/online/visibility recovery and Task due-time transitions. [useCachedPage](../../frontend/src/shared/hooks/use-cached-page.ts#L39) separates silent reads from manual-refresh feedback, retaining request sharing, cancellation and stale-read guards. |
| Deal menu height changed while recipients resolved | The item renderer displayed changing recipient eligibility/loading reasons beneath labels. | [DealCardMenu](../../frontend/src/shared/components/crm/deal-card-menu.tsx#L147) renders existing icons and labels only. Disabled reasons remain in title text. Existing action hosting, recipient validation and keyboard navigation remain. |
| Status backgrounds disappeared on hover/focus | Shared outline Button interaction styles replaced status backgrounds, including Cancelled's dark background underneath light text. | Extend [CRM_STATUS_PRESENTATION](../../frontend/src/lib/utils.ts#L33) and the [Task palette](../../frontend/src/features/tenant/operations/tasks/ui/task-status.tsx#L3) with matching hover, focus and active colors. Retain focus rings and existing appearance scopes. |
| Extra Account/Deal reads | Account handlers invalidated and fetched after centralized successful-write invalidation. Closing an unmodified Deal panel also fetched. | Reuse centralized invalidation in [useAccounts](../../frontend/src/features/tenant/crm/accounts/hooks/use-accounts.ts); remove the close-only board refetch in [PipelinePage](../../frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx). |
| Customer status was reread instead of adopting the successful response | The shared Deal profile header discarded its customer's successful status response. | [saveCustomerStatus](../../frontend/src/shared/components/crm/crm-record-view.tsx#L236) adopts the canonical customer response and silently reconciles the Deal. Existing invalidation updates other views. |
| Late mutation responses could restore data after access changed | The cached setter lacked the identity guards already used by reads. A regression reproduced an old payload appearing after a user switch. | [setData](../../frontend/src/shared/hooks/use-cached-page.ts#L141) rejects obsolete record/session/generation/eviction scopes, disabled readers and unmounted readers. Authoritative 401/403/404 responses invalidate old setters. Ordinary content invalidation still accepts canonical save results. |

## Existing architecture and business rules preserved

Reused `useCachedPage`, `useModuleData`, the Task query owner, `DataProvider` revision streams, `invalidateApiPageCache`, `ModuleWorkspace`, `RefreshButton`, shared record panels/inline editors, `DealActionsProvider`, `CustomerStatusMenu`, CRM/Task palettes, `useCrmRecordAccess`, and backend CRM authorization services.

Manual status editing remains in shared profile headers. Existing module edit grants and record-assignment checks apply to Client Admin, Sales and custom roles. Unlinked Leads/Contacts support permitted engagement changes. Deal-governed customers retain cancellation/reopening restrictions; confirmed sales govern Closed Deal; converted Leads retain their restrictions. Deal engagement stays calculated, and pipeline stages use their existing governed actions. No enum, schema, database migration, permission key or HTTP contract changed.

## Changed files

Production files:

- `frontend/src/store/DataContext.tsx`
- `frontend/src/shared/hooks/use-cached-page.ts`
- `frontend/src/shared/hooks/use-module-data.ts`
- `frontend/src/shared/components/crm/deal-card-menu.tsx`
- `frontend/src/shared/components/crm/crm-record-view.tsx`
- `frontend/src/shared/components/crm/module-workspace.tsx`
- `frontend/src/lib/utils.ts`
- `frontend/src/features/tenant/operations/tasks/use-tasks.ts`
- `frontend/src/features/tenant/operations/tasks/ui/task-board.tsx`
- `frontend/src/features/tenant/operations/tasks/ui/related-tasks.tsx`
- `frontend/src/features/tenant/operations/tasks/ui/task-status.tsx`
- `frontend/src/features/tenant/crm/accounts/hooks/use-accounts.ts`
- `frontend/src/features/tenant/crm/accounts/ui/accounts-page.tsx`
- `frontend/src/features/tenant/crm/leads/hooks/use-leads-data.ts`
- `frontend/src/features/tenant/crm/leads/ui/leads-page.tsx`
- `frontend/src/features/tenant/crm/contacts/ui/contacts-page.tsx`
- `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx`

Regression files:

- `backend/src/modules/crm/access/crm-record-access.integration.test.ts`
- `backend/src/modules/operations/tasks/__tests__/tasks.integration.test.ts`
- `frontend/src/shared/hooks/__tests__/cached-page.integration.test.tsx`
- `frontend/src/store/__tests__/deals-realtime.test.tsx`
- `frontend/src/shared/components/crm/crm-record-view.realtime.test.tsx`
- `frontend/src/shared/components/crm/__tests__/crm-status-forms.test.tsx`
- `frontend/src/shared/components/crm/__tests__/deal-stage-actions.test.tsx`
- `frontend/src/shared/components/crm/__tests__/panel-migrations.test.tsx`
- `frontend/src/features/tenant/operations/tasks/__tests__/use-tasks.test.tsx`
- `frontend/src/features/tenant/operations/tasks/__tests__/task-board-empty-state.test.tsx`
- `frontend/src/features/tenant/crm/contacts/ui/contacts-refresh.test.tsx`
- `frontend/src/features/tenant/crm/leads/ui/__tests__/leads-empty-state.test.tsx`
- `frontend/src/features/tenant/crm/pipeline/ui/pipeline-ordering-refresh.test.tsx`
- `frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.test.tsx`
- `frontend/src/features/tenant/crm/pipeline/ui/pipeline-search.test.tsx`

Acceptance and documentation:

- [verify-crm-stability-browser.mjs](../../backend/scripts/verify-crm-stability-browser.mjs): real UI, authenticated API, delayed reads/recoverable failures, persistence and computed appearance matrix.
- [verify-deal-actions-browser.mjs](../../backend/scripts/verify-deal-actions-browser.mjs): align stale selector expectations with the read-only pipeline field already present on current `main`.
- [qa-ci.cjs](../../scripts/qa-ci.cjs): register the new suite in the existing native-browser inventory.
- This verification report.

## Actual verification results

| Check | Result |
| --- | --- |
| `npm run lint` | All three workspaces passed, including backend test TypeScript. Frontend lint/type checking passed again after the final cache guard. |
| Production builds | Frontend/shared and backend/shared filtered `npm run build` runs passed. The final guarded frontend rebuilt successfully and generated all 180 pages. An earlier root `npm run build` also passed. |
| Focused backend unit tests | 77/77 passed across customer classification, Deal engagement, Task service and Task controller suites. |
| `npm run test:integration:native -- --filter=crm-record-access.integration,deal-engagement.integration,tasks.integration` | PASS on unchanged source: 57 CRM access/status cases, 13 Deal engagement/workflow cases and 24 Task cases; 94/94 passed, no skips. The populated migration/startup rehearsal also passed all three checks. |
| Final cache/provider integration | 56/56 passed, including real provider/related-Task/editor flows, delayed reads, recoverable errors, canonical saves, Deal links, duplicate revisions, reconnects, recovery, cleanup and stale canonical-write rejection. |
| Targeted canonical/scope cases | 27/27 passed. The original user-switch cache race failed before the guard and passed after it. |
| Original full frontend run | 2,898 passed and 17 failed across 226 files (2,915 tests). All 17 failing cases subsequently passed in focused reruns; this is not presented as a clean second full-suite run. |
| Follow-up UI checks | Auth lifecycle 30/30; pipeline page 19/19; pipeline search 15/15; Task empty state 16/16; Lead empty state 25/25; Activity realtime 23/23; role permissions 51/51. The large profile suite passed 226 other cases, and its remaining customer-status case passed after record-readiness/canonical-response fixture correction. |
| Final browser acceptance | PASS on unchanged source: 5 stability flows, 840 appearance combinations (minimum contrast 4.85:1), 68 Deal action checks, zero page errors, and the mailbox worker restart check. |
| QA coordination tests | 13/13 passed outside the restricted sandbox. |
| Syntax and diff checks | Both browser scripts passed `node --check`; `git diff --check` passed. Report references were checked separately. |

The browser matrix covers Inquiry, Hot, Warm, Cold, Closed Deal and Cancelled in Lead and Contact side panels and full pages, across Classic, Light, Dark, System/light and System/dark, with all seven supported accents. Every combination checks hover, keyboard focus, active state and computed text contrast against 4.5:1.

The Deal suite exercises all menu actions, keyboard interaction, mobile stage actions, archive/restore, closing evidence, cancellation reasons, linked Task creation, note persistence, email-composer navigation and second-session synchronization preserving drafts. Native APIs verify role grants/denial, tenant/assignment boundaries, invalid values, canonical persistence, cancellation/reopening, conflict/version protection, idempotency and automatic workflow transitions.

Local evidence is retained under ignored `data/outputs/system-audit/`, including:

- `crm-stability-frontend-initial.json`, `crm-stability-rechecks.json`, `crm-stability-permission-ui.json`, `crm-stability-canonical-status-final.json`
- `crm-stability-backend-unit.json`, `crm-stability-cache-provider-final.json`, `crm-stability-canonical-guards-final.json`
- API run `1792621475646-68ecb3c2-4f31-4632-98e3-93252a0730c2` (`qa-integration-native.json`: PASS, source unchanged)
- Browser run `1792621917660-0f77fc78-392a-4652-afbd-3790a87bfc67`

## Earlier failures and verification boundaries

Earlier acceptance attempts exposed stale selectors and fixture assumptions; those were corrected against the existing UI and assignment rules. The multi-context Task pagination/history test timed out under its 20-second deadline during concurrent local checks. Its deadline is now 60 seconds; all existing assertions remain, and the final Task suite passed. This adds no runtime delay or production timer.

A build attempt encountered a Windows Prisma DLL lock while database workers were active; the later backend build passed after they stopped. The guarded startup rehearsal initially missed readiness, then passed with the rebuilt backend. Earlier runs edited during verification were marked for revalidation by the coordinator and were followed by unchanged-source acceptance runs.

The complete frontend suite was not repeated as one final command. Its failing cases and directly affected suites were rerun as described above. The repository-wide documentation checker reported 109 broken links in existing documents/artifacts; the new report's references were checked independently. Those unrelated historical links were left outside this change.

Acceptance used disposable local databases and synthetic users. It did not modify the configured application database or send real email/SMS. Send Email checks open the existing composer; provider behavior in worker tests is simulated. Production deployment, live provider delivery and remote CI are not claimed as verified by these local runs.
