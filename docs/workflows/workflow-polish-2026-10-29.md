# Workflow polish — 29 October 2026

Base: `c616d45a`, verified against remote `main` before implementation.

## Changes

- Shortened builder, condition, assignment, email, due-date, test and version-history guidance. Removed the repeated template description; optional execution details and runtime limits are expandable. Activation prerequisites, validation and delivery requirements remain visible. Saved user content and historical definitions are unchanged.
- Assignment guidance now explains the selected method. Task capacity text includes the pending, in-progress and blocked work counted by the existing backend.
- Workflow role options exclude the shared `Role.CLIENT_ADMIN` identity. The frontend also filters stale options. Server role resolution rejects that target for validation, publication, activation, previews and execution; draft saves explicitly reject it too. Existing forbidden references remain readable for repair. Users must replace or clear the target before saving; incomplete drafts retain their existing unselected-target support.
- A successful details-panel mutation followed by a failed parent refresh now produces one refresh warning, rather than a false mutation failure. Failed mutations still report one error.
- Failed version restores keep the confirmation open with an actionable error and retry. Successful restores show one notification. A failed version-history request no longer also claims the history is empty.
- Run-detail focus indicators use the existing theme ring token instead of fixed blue.

No changes to global roles, permissions, database schema, workflow catalogs, action ordering, assignment algorithms or message delivery behavior.

## Verification

| Check | Result |
| --- | --- |
| Workflow frontend | 315 unique cases verified across the full suite and focused reruns |
| Workflow backend unit tests | 124 passed across 13 suites |
| Disposable PostgreSQL integration | 237 passed; 3 baseline failures across 10 suites |
| Browser acceptance | 14 journeys passed; no page errors; cleanup complete |
| Workspace lint, including backend test types | Passed for all three packages |
| Frontend, backend and shared package builds | Passed |

The last aggregate frontend run encountered a host pause/worker timeout. Both affected suites were rerun with one worker: 98 tests passed. Role filtering and version-history regressions also passed. Initial sandbox cache failures were resolved by running checks outside the sandbox; the stale Prisma client from the main-branch pull was regenerated.

Browser acceptance used the built application, real authenticated API and a disposable native PostgreSQL database. It checked scratch creation; creating/editing role targets; legacy repair; option refresh without losing edits; saving; publishing; Task assignment and activity links; side-effect-free testing; pausing; version restoration; duplication; archival; forged draft requests; and single notifications. Layout checks covered 320, 768 and 1440 pixels in light/blue and dark/teal themes. Screenshots were reviewed after panel animations settled.

The integration suites cover existing conditions, triggers, execution deduplication, stage transitions, ownership, task associations, assignment strategies, permissions, tenant scope, and provider fixtures. External Gmail/SMS delivery was not tested against real accounts.

The [browser harness](../../backend/scripts/verify-workflow-polish-browser.mjs) reproduces all 18 journeys, including the step-description follow-up. It writes results and screenshots to `data/outputs/workflow-polish-browser/`. Generated QA output is kept locally and is not committed.

## Remaining baseline failures

The same three failures were reproduced against an exported, unchanged `main` snapshot using a separate disposable database:

1. Won Deal conversion with an open sibling expects the Lead to remain `Inquiry`; main returns `Closed Deal`.
2. Reusing an existing Contact expects one `contact.updated` event; main emits two.
3. A returning public Form inquiry expects one Contact status-change event; main emits none.

These are assertion mismatches in `conversion-events.integration.test.ts`, also present without this patch. They need a dedicated review against the CRM status/event policy; this UI polish does not change CRM conversion behavior or weaken those assertions. Consequently, this report does not claim that every cross-module integration test passes.

## Reproduce

Run the existing workspace lint, individual package builds, frontend Workflow tests and backend Workflow unit tests. Supply the acceptance build's explicit `API_URL` when building the frontend; the browser harness redirects transport to its local fixture backend.

For database checks, set `POSTGRES_TEST_BIN` to the installed PostgreSQL bin directory, then run `npm --prefix backend run test:workflows:integration`. After building both applications, run `node backend/scripts/verify-workflow-polish-browser.mjs` for the Workflow-only browser journeys. The fixtures use disposable databases and block external providers.

The earlier `codex-before-pull-main-2026-10-29` stash and unrelated local files were left untouched.

## Step-description follow-up

The follow-up removes the Workflow-only SMS footer insertion button and its note, both versions of the repeated canvas/save instruction, generic step descriptions in the library and canvas, and duplicate email field hints. Send Email retains one sender sentence. Assignment, availability, task-association and linked-stage guidance is shorter. The repeated SMS setup note was removed while its actual validation message remains; empty template lists now say “No email templates available.” Field labels, selected-value summaries, validation rules and required warnings remain.

Saved SMS/footer text, variables, controls, action settings and workflow execution are preserved. Obsolete accessibility hint references were removed while error references remain. The shared Campaign SMS footer control and backend/API code received no follow-up changes.

Verification: all 315 Workflow frontend tests passed; 109 focused tests passed again after the final copy adjustments. Frontend type checks and the final production build passed. All 18 browser journeys passed with no page errors or cleanup errors, including all seven step panels at 320/1440 pixels in light/dark themes, absence of the requested text/control, one SMS setup warning per inspector, working variable insertion and availability controls, and exact saved-action data comparisons after editing.

The follow-up run's local evidence is in `data/outputs/workflow-step-copy-browser/`: `results.json`, `step-email-Light-320.png` and `step-sms-Light-320.png`. These generated artifacts are not committed; rerunning the reusable harness produces equivalent evidence in its output directory. The earlier baseline conversion-test findings above remain outside this presentation-only follow-up.

PR checks exposed a missing QA inventory registration for the new browser harness. It is now registered with the existing native PostgreSQL suites, with a regression assertion that it receives exactly one acceptance owner. All 13 QA coordination tests passed after the registration fix.
