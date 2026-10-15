# Workflow and CRM form improvements

Implementation and local verification: 16 October 2026.

## Result and compatibility

- Workflow email uses the triggering Lead or Contact's assigned agent, including
  an earlier workflow assignment. The agent must have an active, owned Gmail
  connection and current recipient/module permissions. Missing ownership,
  connection or permissions produces a correction in Run Check and run history.
  Legacy `senderUserId` is accepted and discarded; it never selects a mailbox.
- Campaign and Workflow use the same variable picker and cursor insertion utility.
  Workflow insertion offers only the triggering person's eligible standard/custom
  fields. Previously supported saved tokens and template tokens remain valid.
  Unsupported tokens block saving/sending; missing optional values render blank
  with named warnings. Whitespace-only overrides fall back independently to the
  template subject/message. Run Check renders earlier projected updates in a
  sanitized, sandboxed email preview.
- Create Task defaults to the triggering Deal, or one related Deal for Lead,
  Contact and historical Account triggers. Lead/Contact workflows can explicitly
  select all matching related Deals and pipeline, current-stage or Product filters.
  An old exact `dealId` remains an optional searchable constraint. Contacts include
  relationships inherited from converted Leads. Eligible terminal Deals remain
  selectable.
- All-matching creates **one Task** with the complete, sorted association set.
  Zero matches, ambiguous single matches and more than 50 associations fail with
  corrective messages. Selection is shared by Run Check and execution and is
  revalidated with permissions inside the existing Task transaction. Task output
  includes authorized Deal names and a count such as “Creates 1 task linked to
  3 deals.” Existing Task assignment, audit, activity and notification behavior is
  retained.
- Existing event deduplication, leases, uncertain-delivery evidence and terminal
  run behavior remain in place. Task reconciliation reuses the original step ID,
  canonical payload, due date and assignee. Successful email steps remain visible
  after a later Task failure and are not resent by repeated queue processing.
  No retry control, failed-step replay endpoint, automatic terminal replay or
  database migration is introduced.
- Lead/Contact account sections have two mutually exclusive modes: **Link
  existing account** and **Create new account**. New forms default to optional
  linking. Creation reuses Account controls and validation, keeps Account/person
  addresses separate, and retains drafts when switching modes or after failures.
  Mode-specific payloads use existing atomic Account/person creation and stable
  request receipts. Existing Account selection updates the canonical link and
  displayed company name. Unchanged historical company text remains preserved.
- Standalone Account Full Address spans both desktop columns and remains one
  column on mobile. Saves await backend confirmation, reject duplicate pending
  submissions and preserve typed inline errors. Contact mutations also invalidate
  Deal lists and counts.

See [API contracts](API.md) and [CRM organization behavior](crm-polish.md) for
request shapes and existing Account transaction rules.

## Existing configurations that need attention

An absent or legacy sender setting alone requires no repair. A triggering person
without an eligible assigned agent needs an assignment, that agent's Gmail
connection in Inbox, or restored permissions. A single-match Task with several
related Deals needs narrower filters, a specific related Deal, or explicit
all-matching selection for a Lead/Contact trigger. Missing/deleted filter records,
inconsistent pipeline/stage settings, unsupported variables, or an empty rendered
message require correction in the saved configuration. History and successful
steps are preserved while users repair future runs.

## Verification performed

| Check | Result |
| --- | --- |
| Affected frontend suites | 307 tests passed across 25 files |
| Workflow backend unit suites | 32 tests passed across 4 files |
| Workflow native integration | 92 tests passed |
| Workflow Task association native integration | 11 tests passed |
| Task service native integration | 23 tests passed |
| Account/person atomic linking native integration | 12 tests passed |
| Production browser acceptance | 51 checks passed; no page or API 5xx errors |
| Workspace lint, including backend test types | Passed |
| Shared, backend and frontend production builds | Passed |
| Documentation links and whitespace checks | Passed |

The final builder/preview recheck passed all 64 selected tests after fixing the
mobile inspector overlapping Run Check. QA isolation checks passed 16 tests;
one Linux-only temporary-directory case was skipped on Windows.

Native integration used fresh PostgreSQL 18 databases with `fsync`,
`synchronous_commit` and `full_page_writes` enabled. The tests cover projected
sender/field changes, unavailable connections and revoked permissions, tenant
isolation, template fallback and warnings, zero/ambiguous/filtered/converted
relationships, 50/51 associations, relationship and permission changes before
commit, canonical Task reconciliation, concurrent duplicate submissions,
atomic rollback, and persisted execution outcomes.

The maintained browser acceptance script exercises the production frontend and
real loopback API against a disposable migration-replayed database. It checks
375px/1440px light/dark layouts, Lead/Contact creation with linked Accounts and
refresh, standalone Account address placement, record/relationship navigation,
workflow history, variable selection replacement and focus, saved association
settings, and rendered Run Check previews. Database counts confirm Run Check
creates no Task, delivery log or execution run. Sandboxed preview checks use a
guarded test service-worker blocker because Playwright's default injected blocker
cannot read `navigator.serviceWorker` in an opaque sandbox frame.

Relevant commands:

```sh
npm run lint
npm run qa:build
npm run qa:docs
node backend/scripts/verify-crm-polish-browser.mjs
npm run test:integration:native -- --filter=workflow.integration,workflow-task-associations,tasks.integration,organization-polish
```

The full native runner's preliminary guarded-startup rehearsal currently fails
its existing serving-commit metadata assertion (`backend/scripts/test-guarded-startup.mjs:68`)
before reaching these suites. The four affected suites were therefore also run
directly with the existing disposable native PostgreSQL fixture and isolated QA
environment; all 138 tests passed. This does not establish a passing full release
gate. Live Gmail delivery was mocked, and no deployment or application-database
migration was performed.
