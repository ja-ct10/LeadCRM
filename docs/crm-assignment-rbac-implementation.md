# CRM assignment RBAC implementation and acceptance

Status: implementation and local release verification completed. Production acceptance remains open; this report does not declare production readiness.

Review base: `b71f035380a3356c83d039fc99db798821ab390d`. At the user's explicit request, publication includes all current LeadCRM workspace changes. The RBAC manifest identifies the RBAC subset; combined verification also includes Forms, Campaigns, CSV Imports and Settings.

## 1. Existing RBAC audit

HTTP routes already check authenticated identity, workspace state, tenant and module permissions. Prisma tenant middleware scopes database operations. Lists generally already read eligible tenant-wide records. Record write services previously relied chiefly on module grants and tenant predicates; those checks did not establish current direct assignment.

## 2. Confirmed vulnerabilities and causes

A Sales actor with Edit could reach another agent's same-tenant record through ordinary update, archive, stage, custom-field and auxiliary services. UI controls used module permissions and sometimes displayed Deal owner attribution as an assignee fallback. Preflight ownership checks alone could race reassignment. These paths now share a transactional database boundary.

## 3. Sales classification

Resolve the current database User, tenant, active RoleDefinition memberships and effective grants. Restrict known Sales / Sales Rep / Sales Representative / Sales Agent / Sales Staff / Sales Manager identities and any role with the durable server-managed assignment flag. Multiple ordinary memberships never cancel a Sales restriction. Only protected database `User.role === 'Client Admin'` grants the administrative exception.

Role creation classifies known Sales identities; role edits preserve classification across renames. No browser field sets this flag. The production Camxian workspace's visible role catalog was inspected: Sales and Client Admin. Other tenants and previously renamed arbitrary Sales labels still require a deployment audit.

## 4. Shared authorization

`crm-record-access.service.ts` propagates verified request identity, wraps protected Prisma mutations in interactive transactions, locks canonical tenant rows, reloads assignment and current grants, and denies unauthorized writes. Fixed table names and parameterized SQL are used for internal locks. Ordinary request raw SQL and array transactions cannot bypass this boundary. Serializable conflicts retry and recheck assignment.

The shared contract exposes a minimal server-resolved assignment policy. UI decisions fail closed while it is unavailable and combine assignment access with existing action permissions.

## 5. Leads

Native HTTP/PostgreSQL checks cover all eligible assignment categories, search, details, custom-field reads, assigned edits, denied edits, archive/restore, conversion, merges and reassignment. Parent assignment does not grant edits to affected Deals. Browser checks cover read-only details and the stale-save scenario.

## 6. Contacts

The same read and write cases are covered. A Deal may reference another-agent Contact without changing it. Closing/cancellation cascades must separately authorize any Contact they change.

## 7. Accounts

Accounts retain tenant-wide reads and use authenticated actor identity for optional My filtering. Spoofing currentUserId does not change My scope. Assigned edits and denied foreign/unassigned/archive/restore/reassignment cases are covered.

## 8. Deals

Authorization uses canonical `assignedUserId` only. `ownerId`, creation attribution, parent Leads and related Contacts do not grant edit rights. Tests deliberately retain a different owner attribution. Stage, pipeline, closing, participant junction, reorder and bulk paths share the boundary.

## 9. All and My records

All remains the default. My is an explicit filter. HTTP tests check both scopes, paging and actor spoofing. Browser list checks include own, other-agent and unassigned records for all four modules. Archived records continue to follow existing archive permissions.

## 10. Direct API enforcement

Ownership denials return 403 with a module-specific message. Foreign IDs remain 404. No View permission remains 403 independently of assignment. Current grants are read from the database rather than accepted from token/browser claims.

## 11. Custom fields and relationships

CustomFieldValue, RecordFile, product junctions, Deal participant junctions and stage histories authorize their canonical parents. Empty replacements and indirect writes remain protected. Sales mutation denials retain separately authorized custom-field read data. Merge and status cascades roll back when an affected record is unauthorized.

## 12. Stage and Kanban

The existing board remains tenant-wide. Unowned cards cannot drag or offer mutation actions. Backend transitions check assignment before business validation, including no-op requests. Existing stage histories, Lost reasons, closing requirements and pricing remain authoritative.

## 13. Bulk operations

Authorize every selected Deal before starting the batch. Initially denied mixed batches have no committed side effects. Each actual write rechecks current assignment in its own transaction; concurrent changes can produce the existing explicit partial result. A zero-success authorization denial returns 403. No-op stage rows recheck current ownership too.

## 14. Reassignment prevention

Sales cannot assign an existing own, other-agent or unassigned record to anyone else, clear assignment, or directly claim it. Explicit create-time assignment to another agent is denied. Existing automatic assignment and generated Deal initialization remain available. Initialization privilege lasts only for the creating transaction.

## 15. Client Admin

Native tests exercise administrative reassignment for all four modules and immediate rejection of the old agent, with the new assigned agent able to edit. An ordinary admin-named RoleDefinition membership does not promote a Sales actor. The authorized live Client Admin deactivation flow completed on the existing deployed revision: Julie Ann Doe became inactive and the confirmed transfer covered 5 Leads, 1 Contact, 2 Accounts and 7 Deals to Julie Ann Tiron, with zero unfinished Tasks. This precedes the RBAC release and does not establish its post-deployment behavior.

## 16. Workflows and background services

Direct service calls keep the originating actor restriction. Saved Workflow execution receives a separate tenant-bound authority only after its existing active author, configuration, action grants and current saved definition are validated; execution runs and steps retain provenance. There is no browser-controlled system bypass.

Existing autonomous services keep their existing explicit tenant/business policies. The broad local CRM/Workflow suite passed, including automatic Deal and public-form assignment regressions. Live provider and scheduler acceptance is pending.

## 17. Cross-tenant security

HTTP reads and writes reject foreign IDs; tenant-wide lists exclude foreign records. Database tenant checks remain installed. Internal locking is a narrow exception to the raw-query deny policy.

## 18. Concurrency and stale saves

Independent native PostgreSQL connections hold an administrative reassignment open while the old actor's HTTP save waits. After commit, the old save returns 403 and does not overwrite assignment or fields. Browser acceptance opens an owned editor, reassigns through the admin API, then proves Access Denied feedback and read-only refresh while the record remains readable.

## 19. Files modified

See [the RBAC subset manifest](crm-assignment-rbac-release-files.txt). The combined publication also includes canonical Lead fields in Forms, related Account/Deal campaign personalization and audience paging, authoritative CSV import outcomes, and Settings scroll containment. Fixture changes provide explicit policy/auth/field-layout context and update stale selectors; assertions continue to exercise the intended behavior. The Git commit is the authoritative inventory of all included workspace paths.

## 20. API changes

Add authenticated, workspace-scoped `GET /api/v1/crm/record-access`. Its response includes current user/tenant IDs, assignment restriction and protected Client Admin status, with no-store caching. Existing mutation shapes remain compatible; assignment denials now enforce the specified 403 outcome.

## 21. Database changes

One additive migration: `20261125000000_crm_assignment_policy`. It adds `RoleDefinition.crmAssignmentRestricted` and classifies known Sales role names. No CRM records, assignment values, historical Deal owners, permission flags or provider IDs are rewritten. The existing phased deployment runner recognizes this reviewed independent migration. Do not use reset, db push or bypass retirement guards.

Fresh disposable PostgreSQL clusters replay all repository migrations with stop-on-error. Production execution and migration ledger remain pending.

## 22. Automated tests

- Combined primary-workspace CRM, Workflow, Forms and Campaign run: 494 passed across 52 files; 213 cases in eight files require alternate disposable database guards. Dedicated runs below cover those guards. The migration deployment-plan checks passed all 9 cases after the expected final reviewed migration was advanced to the additive Sales policy migration; retirement exclusions remain asserted.
- Native RBAC suite: 62 passed in the final isolated release checkout (included in the final 234-test CRM/Deal/automatic-assignment run), including independent PostgreSQL concurrency, indirect cascades, scalar archive syntax, nested writes, explicit creation spoofing and legitimate round-robin creation.
- Broad isolated CRM and Workflow run: 356 other cases passed; 148 were guarded by alternate disposable database names. The security fixture failure in that run was corrected to use the canonical Product Interest contract and all 61 security cases passed on rerun.
- Existing permission integration suite: 10 passed in the isolated release checkout.
- Guarded Workflow suites: 175 passed across 12 files using the dedicated disposable Workflow database, including the cases skipped in the broad run. CRM completion: 14 passed. Custom fields: 19 passed.
- Guarded Campaign suites: 94 passed across 5 files, including all 66 native integration cases. The combined review found scheduling accepted unresolved related Deal variables. Scheduling and Send Now now share recipient relationship validation; regressions prove missing and ambiguous links deny without recipients/provider calls and a single eligible Deal renders its value. Existing saved schedules retain their strict audience shape during rescheduling.
- The primary frontend checkout passed 1,458 tests across 160 files after explicit auth/policy/layout fixtures and stale selectors were corrected. The isolated frontend run across 159 files passed 1,415 of 1,416 tests; its one failure expected the outdated Custom Fields label. Correcting that fixture to the unchanged Customize Fields label produced 12 passing tests in that file. The final API/cache/custom-field rerun passed 101 tests across 8 files. No product navigation was changed.

The final combined primary frontend rerun passed all 1,458 tests across 160 files, with zero failed tests. Windows sandbox temporary-file restrictions prevented the initial attempt from loading suites; the approved rerun executed the tests successfully. The runner creates a private temporary loopback PostgreSQL cluster and never uses the configured application DATABASE_URL. The inactive-assignee fixture temporarily disables a User trigger only inside that disposable cluster to reproduce historical data, then restores it.

## 23. Browser tests

The final isolated release checkout passed 93 checks: four read-only detail modules and four assigned-record inline editors at 320, 375, 390, 430, 768, 1024, 1440 and 1920px; eight Kanban checks; four default lists; one stale reassignment/save case; and sixteen Client Admin Team Management/Roles responsive checks. No document overflow or page JavaScript error was found.

The combined primary workspace also passed the same 93 checks, with zero page errors. Evidence directories: `C:\Users\Julie Ann Tiron\AppData\Local\Temp\leadcrm-rbac-browser-1791737824328` (isolated RBAC subset) and `C:\Users\Julie Ann Tiron\AppData\Local\Temp\leadcrm-rbac-browser-1791738442182` (combined workspace). This is local acceptance, not live multi-user/provider proof.

## 24. Build results

All three combined primary workspaces passed `npm run lint` and `npm run build`, including Prisma generation and both production builds. The build supplied the explicit public production API_URL required by existing frontend configuration validation. Shared build, backend and frontend lint/type checks and production builds also passed in the isolated release checkout.

## 25. Coolify status

The authenticated Coolify dashboard was inspected. Both latest successful deployments show `b71f035380a3356c83d039fc99db798821ab390d`: backend deployment `eaay94j2mudcpjpolpha2ygu`, frontend `tyafz3rpcj0hfy6xcw8ro0fl`. Backend health returned status ok; frontend returned its normal anonymous login redirect.

At this report's pre-publication checkpoint, no RBAC release has been deployed. Local combined verification and publication review are complete. Matching-service deployment and live acceptance remain separate checks; health alone does not prove RBAC or migration readiness.

## 26. Remaining work and risks

- Publish the reviewed revision, apply the additive migration through db:deploy, and deploy matching services.
- Verify live Sales visibility/read-only/assigned editing/direct 403, Client Admin reassignment, stale edits, logs and migration ledger in an authorized QA context.
- Audit other tenants and arbitrary previously renamed Sales identities before assuming coverage.
- Finish live multi-user and provider/background compatibility checks. I cannot confirm this.
