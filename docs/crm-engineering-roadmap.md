# LeadCRM — CRM Engineering Roadmap

**Status:** Living document · **Last revised:** 2026-08-07
**Question this document answers:** *What should be built next?*

Reads with: `crm-audit-report.md` (what is wrong) and
`crm-architecture-blueprint.md` (what it should become).

> This roadmap states objectives, value, risk, and acceptance criteria. It names files
> and identifiers only where a specific location is the whole point of the task.
> **Implementation approach is chosen at the start of each phase, not here** — see §3.

---

## 1. Sequencing Principle

Correctness before capability. Each phase must leave the product in a shippable state.

```
Phase 0  Documentation & decisions      ← you are here
Phase 1  Data integrity + security      ← unblocks 60% of the audit
Phase 2  Semantic model
Phase 3  Relationships
Phase 4  Navigation & module unification
Phase 5  Governance & automation
Phase 6  Experience & accessibility
Phase 7  Honesty, performance, polish
```

**Why data integrity leads.** Audit root cause 1 (DI-1/DI-2) is upstream of the
reporting, analytics, timeline, and automation defects. Building features on top of it
means building on data that is not being recorded. Phase 1 also carries the one live
security defect (SEC-1), which is not schedulable — it ships first regardless.

**Why the semantic model precedes relationships.** The lifecycle axis is what makes the
Leads and Customers views definable. Building those views before the field exists means
building them twice.

**Why navigation is fourth, not first.** Navigation is cheap and highly visible, which
makes it tempting to front-load. But three of the five modules it exposes are wrong until
Phases 2 and 3 land. Exposing a broken Customers view to users is worse than leaving it
unreachable.

---

## 2. Traceability

| Phase | Audit findings closed | Requirements advanced |
|---|---|---|
| 1 | DI-1, DI-2, DI-3, DI-4, DI-8, SEC-1, SEC-2, UX-1, UX-2, UX-3 | REQ074 |
| 2 | BW-1, BW-2, BW-3, TD-3 | REQ131, REQ134, RC-1, RC-6 |
| 3 | DI-5, DI-6, DI-9, BW-4, UX-4 | — |
| 4 | NAV-1, NAV-2, NAV-3, NAV-4, SEC-3, SEC-4, SEC-5, TD-2 | REQ132 (partial), RC-3 |
| 5 | BW-5, BW-6, BW-7, DI-7, TD-5 | REQ089, REQ132, RC-2, RC-4 |
| 6 | UX-5, UX-6, UX-7, TD-6, RC-5 | REQ069, REQ083, REQ084, REQ085, REQ133, REQ135 |
| 7 | TD-1, TD-4 | REQ094–REQ096 |

---

## 3. Per-Phase Entry Protocol

Mandatory before writing code in any phase. This is the mechanism that keeps the roadmap
a guide rather than a script.

1. **Re-validate.** Confirm the findings this phase claims to fix still reproduce. The
   codebase moves; a finding may be stale, already fixed, or now worse.
2. **Search for reuse.** Look for an existing service, hook, component, or utility that
   already does most of the job. Reuse beats extension; extension beats creation.
3. **Check for duplication risk.** If the phase would add a second way to do something
   that already exists once, stop and consolidate first.
4. **Re-derive the approach.** If the architecture has moved since this roadmap was
   written, design against the current architecture. Do not force an outdated
   recommendation through.
5. **Record decisions.** Any non-obvious choice is appended to the blueprint's decision
   log (§11) *before* implementation, with reasoning.
6. **Confirm scope.** If more than five files need changing without a dependency map,
   stop and produce the map first (project stop condition).

**Tie-break order** when several implementations are viable:
`Security → Data integrity → Tenant isolation → Maintainability → UX → Performance → DX`

**Complexity scale:** S = under a day · M = 1–3 days · L = 3–5 days · XL = over a week.

---

## Phase 0 — Documentation & Decisions

**Goal.** Replace the single mixed redesign document with three separated living
documents, and surface every conflict between the redesign and signed requirements
before any code is written.

**Business value.** Prevents building non-compliant features. Three conflicts (RC-1,
RC-2, RC-3) would each have required rework after delivery had they been found during
implementation instead of now.

**Technical scope.** Audit report, architecture blueprint, engineering roadmap. Mark the
two superseded documents as archival. No code.

**Dependencies.** None.

**Risks.** Documentation drifting from code once implementation starts.
*Mitigation:* each phase's exit step updates the audit report to strike closed findings.

**Deliverables.**
- `docs/crm-audit-report.md`
- `docs/crm-architecture-blueprint.md`
- `docs/crm-engineering-roadmap.md`
- Superseded notices on `crm-redesign-validated.md` and `crm-audit-and-plan.md`

**Validation checklist.**
- [x] Audit report contains no solutions or implementation instructions
- [x] Blueprint contains no file paths or column names except where the name is the decision
- [x] Every audit finding has an ID and traces to a phase
- [x] Every requirements conflict is recorded with a resolution decision
- [x] Decision log explains every reversal of the earlier redesign
- [ ] **Product sign-off on AD-4** (does the five-stage ceiling include won/lost?)
- [ ] Roadmap reviewed for consistency against the existing architecture

**Complexity.** S · **Status.** Documents complete; two sign-offs open.

---

## Phase 1 — Data Integrity & Security

**Goal.** Make one governed path the only way a deal's stage can change, and prove
tenant ownership of every stage referenced by a client.

**Business value.** The highest-leverage phase in the roadmap. It closes a cross-tenant
boundary defect and, as a side effect, turns on stage history, real velocity analytics,
the deal timeline, workflow triggers, and forecast accuracy — features already built and
currently inert. Roughly 60% of the audit closes here without new features.

**Technical scope.**
1. Resolve any client-supplied stage identifier within the tenant before use, in both the
   service and repository layers. Miss returns 404. *(SEC-1 — ships first, independent of
   the rest of the phase.)*
2. Give stages direct tenant ownership, derived from the parent pipeline, with backfill.
   Not independently editable. *(SEC-2)*
3. Close the ungoverned write path: stage change is removed from the general deal-update
   contract. Every stage change — board drag included — routes through the governed
   transition. *(DI-1, DI-2)*
4. The governed transition emits its full effect set unconditionally, inside one
   transaction: stage change, history row, timeline activity, audit entry, trigger
   evaluation. The won-deal handoff remains an *additional* effect, not a precondition
   for the timeline entry. *(DI-3)*
5. Derive stage duration from the previous transition timestamp, falling back to deal
   creation. Never from a general modification timestamp. *(DI-4)*
6. Terminal classification by flags only, everywhere — board drop handling and forecast
   maths included. *(UX-2, UX-3)*
7. Persist deal ordering within a stage. Scope the operation under its pipeline so the
   tenant check is structural. *(DI-8)*
8. Velocity and analytics surfaces render an empty state when history is absent. Delete
   the fabricated fallbacks. *(UX-1)*

**Dependencies.** None. Deliberately first.

**Risks.**

| Risk | Mitigation |
|---|---|
| Removing stage change from the general update contract breaks an unaudited caller | Enumerate every caller before the change; the type checker catches the rest |
| Board interaction regresses — the governed path is slower than a local state write | Optimistic move with rollback and an error toast on failure |
| Stage tenant backfill leaves orphan stages whose pipeline is missing | Reconcile and report orphans before backfilling; migration is reversible |
| Deleting fabricated analytics makes the product look emptier | Correct outcome. Empty states are honest; measured data appears as soon as transitions are recorded |

**Validation checklist.**
- [ ] Dragging a card produces exactly: 1 deal update, 1 history row, 1 timeline activity, 1 audit entry, 1 trigger evaluation
- [ ] A stage ID belonging to another tenant returns **404**, not 403, and mutates nothing
- [ ] Stage change via the general update contract is rejected
- [ ] A stage change on a deal with no Account still writes a timeline activity
- [ ] Stage duration is unaffected by an unrelated edit to the deal
- [ ] A pipeline whose stages are renamed still forecasts correctly
- [ ] Card order survives a reload
- [ ] A deal with no history shows an empty state, no numbers
- [ ] Type check clean; regression suite green
- [ ] Tenant-isolation and audit-write tests added for the transition path

**Deliverables.** Tenant-scoped stage resolution · stage ownership migration with
backfill · single governed transition emitting five effects · flag-only terminal
classification · persisted ordering · honest analytics states · tests for isolation and
audit on the transition path.

**Complexity.** L

---

## Phase 2 — Semantic Model

**Goal.** Split the three meanings currently carried by two fields into four independent
axes, each with one owner.

**Business value.** Makes Leads and Customers definable at all, and fixes the defect where
winning a deal never surfaces the customer (BW-2). Delivers REQ131's manual status lock
structurally rather than by convention, and unblocks REQ134's Individual/Organization
handling.

**Technical scope.**
1. Add the system-owned lifecycle axis to Client Profiles, with an index supporting
   tenant-scoped lifecycle queries. *(BW-1)*
2. Separate record kind from customer standing. Existing enum values are **preserved** —
   per AD-3 nothing is deleted, so no destructive migration. *(BW-3)*
3. Backfill lifecycle from existing data using an explicit, reviewed mapping. Document the
   mapping; it is not reversible by inspection.
4. The won-deal handoff additionally advances lifecycle to Customer. It continues not to
   touch Status. *(REQ131)*
5. Correct the Customers view to filter on customer standing, not relationship status.
   *(BW-2)*
6. Reconcile frontend types against persisted columns. Document which fields are not
   persisted, and either persist them or remove them from forms. A form field that
   silently discards input is a defect. *(TD-3)*

**Dependencies.** Phase 1 — the handoff extension must land on the governed path.

**Risks.**

| Risk | Mitigation |
|---|---|
| Lifecycle backfill mapping is wrong and hard to detect | Review the mapping with product before running it; snapshot affected rows; provide a reversal script |
| An automated path writes to Status, violating REQ131 | Add an explicit test asserting Status is unchanged after a won transition |
| Removing unpersisted form fields is read as feature loss | Inventory and triage them first: persist what has value, remove what does not, decide nothing silently |

**Validation checklist.**
- [ ] Winning a deal advances lifecycle to Customer and sets customer standing to Active
- [ ] Winning a deal leaves relationship Status **byte-identical** — asserted by test
- [ ] Every pre-existing profile has a defensible lifecycle value after backfill
- [ ] The Customers view lists exactly the profiles with Active standing
- [ ] Record kind and customer standing are independently settable
- [ ] No field on any CRM form discards its input
- [ ] Backfill has a documented mapping and a tested reversal path

**Deliverables.** Lifecycle axis with index · record-kind separation · reviewed backfill
plus reversal · handoff extended · corrected Customers view · type reconciliation with a
documented unpersisted-field inventory.

**Complexity.** L

---

## Phase 3 — Core Relationships

**Goal.** Make the Account↔Deal↔Contact triangle structural, and reduce lead
qualification from three forms to one transaction.

**Business value.** Account-level revenue, forecasting, customer handoff, and territory
reporting all depend on the Account link, which UI-created deals currently omit entirely.
Qualification drops from three forms to one dialog.

**Technical scope.**
1. Replace free-text company and contact-person entry with relationship pickers. The
   Account picker supports inline creation; contact selection scopes to the chosen Account
   and assigns a role. *(DI-5, UX-4)*
2. Require an Account in the deal-creation contract. Storage stays nullable pending
   backfill. *(AD-6)*
3. Backfill Account links for existing deals where the company name resolves
   unambiguously. Report the ambiguous remainder for manual resolution rather than guessing.
4. Add a single-transaction qualification operation producing: lifecycle advance, Account
   link or creation, deal in the entry stage, primary contact role, first history row,
   timeline entry, notification, audit entry. Non-destructive — nothing is deleted, all
   history is retained. *(BW-4)*
5. Convert dialog on the Leads view. Creating a deal in the same step is optional.
   *(BW-4)*
6. Normalise deal tagging to match the array shape used by contacts and accounts, so tag
   filtering works across entities. *(DI-6)*
7. Mark the legacy singular deal-to-contact link read-only. Retire only after verified
   backfill. *(DI-9)*

**Dependencies.** Phase 2 — qualification writes the lifecycle axis.

**Risks.**

| Risk | Mitigation |
|---|---|
| Requiring an Account blocks legitimate individual clients | Individual clients get an Account of record type Individual, created inline. Never a null. |
| Account name backfill mis-links deals to the wrong company | Only link on unambiguous match; report the rest for human resolution; log every automatic link |
| The qualification transaction partially applies | Single transaction, all-or-nothing; integration test asserting rollback on induced failure |
| Pickers are slow on large tenants | Server-side search with debounce; do not load full lists into the client |

**Validation checklist.**
- [ ] A deal cannot be created without an Account
- [ ] An individual client can hold a deal via an inline-created Individual Account
- [ ] Every deal created through the UI has an Account link and a primary contact role
- [ ] Qualification produces all eight records, or none — verified by induced-failure test
- [ ] Qualification deletes nothing and preserves all prior history
- [ ] Backfill's ambiguous remainder is reported, not guessed
- [ ] Tag filtering behaves identically across deals, contacts, and accounts
- [ ] No new code reads or writes the legacy singular contact link

**Deliverables.** Account picker with inline create · role-aware contact selection ·
Account required by contract · reconciliation-report backfill · one-transaction
qualification · convert dialog · normalised tagging.

**Complexity.** XL

---

## Phase 4 — Navigation & Module Unification

**Goal.** One navigation registry, one deals module, and a permission surface for Accounts.

**Business value.** Three modules become reachable. Frontend and backend authorisation
stop being able to disagree. Two parallel deal codebases become one, halving the
maintenance surface for the product's most-used screen.

**Technical scope.**
1. Collapse the three navigation copies into one registry consumed by the sidebar,
   command palette, and route map. Delete the dead layout component. *(NAV-1, TD-2)*
2. Group navigation by domain and register every CRM route so active-state highlighting
   resolves. *(NAV-3, NAV-4)*
3. Unify the two deal modules into one with board, table, and forecast views over shared
   data and shared logic. Redirect the retired route for one release. *(NAV-2, AD-9)*
4. Register a dedicated Accounts permission set, seed role defaults, and move Account
   routes onto it. *(SEC-3)*
5. Replace opaque positional permission identifiers with named permissions matching the
   backend registry. *(SEC-4)*
6. Move activity authorisation onto its own permission surface. *(SEC-5)*
7. Present Leads, Client Profiles, and Customers as three views over one module, using the
   terminology fixed in the blueprint. *(RC-3, AD-5)*

**Dependencies.** Phase 2 — the Leads and Customers views need the lifecycle axis to be
correct before being exposed.

**Risks.**

| Risk | Mitigation |
|---|---|
| Merging the deal modules regresses board behaviour | Board is the higher-traffic surface; it is the base, the table becomes a view over it. Not a rewrite. |
| Introducing a permission set locks existing roles out of Accounts | Seed defaults mirroring current effective access, then tighten deliberately as a separate reviewed change |
| Retiring the old permission identifiers changes effective access silently | Produce a before/after access matrix per role and diff it |

**Validation checklist.**
- [ ] Exactly one navigation registry exists; grep confirms no second nav array
- [ ] Every CRM route is reachable from navigation and highlights correctly
- [ ] One deals module; the retired route redirects
- [ ] Board, table, and forecast views share one data path
- [ ] Account routes are governed by Account permissions
- [ ] No opaque positional permission identifier remains in CRM code
- [ ] Per-role access matrix diff reviewed and intentional
- [ ] Every frontend guard names the same permission its backend route enforces

**Deliverables.** Single navigation registry · grouped navigation with full route
registration · unified deals module with three views · Accounts permission set with seeded
defaults · named permissions throughout · reviewed access matrix.

**Complexity.** XL

---

## Phase 5 — Governance & Automation

**Goal.** Make stages enforce data quality, replace simulated automation with real
automation, and complete the Six-Pillar obligations for Deals.

**Business value.** Delivers REQ089 and REQ132. Prevents empty deals reaching late stages
and inflating the forecast. Removes a screen that displays activity which never occurred.
Stale deals raise follow-ups instead of relying on memory.

**Technical scope.**
1. Server-owned pipeline templates for the four required business flows, consumed by both
   the seeder and the create-pipeline UI. Retire the client-side stage generator. *(DI-7,
   TD-5, RC-2)*
2. Seed the four templates with full stage semantics: terminal flags, entry stage,
   probability, colour, entry requirements, staleness threshold. Honour the stage ceiling
   per AD-4. *(REQ132)*
3. Enforce stage entry requirements server-side within the governed transition; the client
   mirrors them for immediate feedback and animates a blocked card back with a clear
   explanation. *(BW-5, REQ089)*
4. Stage administration UI for colour, probability, entry requirements, and staleness
   threshold. Render stage colour on the board.
5. Delete the simulated automation and replace it with the real workflow configuration for
   that stage — or an explicit "no automation configured" state. *(BW-6)*
6. Notifications on deal assignment, stage change, and task assignment. *(BW-7, Pillar 5)*
7. Deal file attachments through the existing tenant document surface. *(BW-7, Pillar 6)*
8. Staleness-triggered follow-up task creation.

**Dependencies.** Phases 1 and 3. Entry requirements are meaningless until the governed
transition is the only path (Phase 1) and until the fields being required are actually
populated (Phase 3).

**Risks.**

| Risk | Mitigation |
|---|---|
| Entry requirements block work on existing deals that predate them | Requirements apply on transition only, never retroactively. Ship with a permitted override that is audited. |
| Migrating existing pipelines to templates disrupts live boards | Templates govern new pipelines; existing ones are migrated opt-in with a preview |
| Notification volume becomes noise and gets muted | Ship the minimum set — assignment and terminal transitions. Add more only on request. |
| Four pipelines under a five-stage ceiling cannot express real flows | Resolve AD-4 with product **before** seeding, not after |

**Validation checklist.**
- [ ] Four pipeline templates exist, server-owned, consumed by seeder and UI alike
- [ ] No client-side code authors stage semantics
- [ ] Every seeded pipeline has an entry stage, a won stage, and a lost stage, all flagged
- [ ] Stage counts comply with the AD-4 interpretation as signed off
- [ ] A deal missing a required field cannot enter that stage — rejected server-side, explained client-side
- [ ] Override of a requirement is possible, permission-gated, and audited
- [ ] No screen displays automation that did not execute
- [ ] Assignment and stage change notify the right users
- [ ] A deal can carry file attachments
- [ ] A deal past its staleness threshold produces a follow-up task
- [ ] Workflow executions produce their full record set or none

**Deliverables.** Server-owned templates for four flows · seeded stage semantics ·
server-enforced entry requirements with client mirror and audited override · stage
administration UI · real automation display · notifications · attachments · staleness
follow-up.

**Complexity.** XL

---

## Phase 6 — Experience & Accessibility

**Goal.** Make every CRM surface honest about its state, operable by keyboard, and
filterable the way the requirements specify.

**Business value.** Closes five outstanding requirements (REQ069, REQ083, REQ085, REQ133,
REQ135) and removes the board-only bottleneck on stage advancement.

**Technical scope.**
1. Stage advancement from the table view, keyboard reachable. *(UX-5)*
2. Loading, empty, error, and populated states audited and consistent across all five CRM
   surfaces. *(UX-6, REQ085)*
3. Chip-based filter bar with removable parameters and saveable views, replacing raw
   selects with the project's filter component. *(RC-5, REQ135, TD-6)*
4. Filter and search parameters survive navigation. *(REQ083)*
5. Hot-first default ordering on Client Profiles. *(REQ133)*
6. Forms migrated to the project's form library with schema validation, client-side before
   submit. *(TD-6, REQ084)*
7. Accessibility: drop announcements on the board, list semantics, focus trapping and
   restoration in drawers, status conveyed by text or icon alongside colour, visible focus
   rings, reduced-motion respected. *(UX-7, REQ069)*
8. Quick-log activity actions on the drawer's first tab, and deals reachable from global
   search.

**Dependencies.** Phase 4 — surfaces must be unified before their states are audited, or
the audit is done twice.

**Risks.**

| Risk | Mitigation |
|---|---|
| Form migration changes validation behaviour subtly | Migrate one form fully, review it, then apply the established pattern to the rest |
| Saved views become a data model of their own | Keep them tenant-and-user-scoped named filter sets. No sharing, no permissions, until asked for. |
| Accessibility work is declared complete without verification | Keyboard-only and screen-reader passes on the critical flows. Automated checks alone are not sufficient evidence. |

**Validation checklist.**
- [ ] A deal's stage can be changed from the table, by keyboard alone
- [ ] Every CRM surface renders all four states
- [ ] No raw select survives as a filter control
- [ ] Filters and search survive navigation and back-navigation
- [ ] Client Profiles default to Hot-first
- [ ] Saved views persist per user per tenant
- [ ] Every CRM form validates client-side before submit
- [ ] Board drop is announced to assistive technology
- [ ] Drawers trap focus and restore it to the trigger on close
- [ ] No status is conveyed by colour alone
- [ ] Every icon-only control has an accessible label
- [ ] Reduced-motion preference is honoured on every animation
- [ ] Keyboard-only and screen-reader pass completed on qualification and stage change

**Deliverables.** Table stage control · consistent four-state surfaces · chip filter bar
with saved views · persisted filter state · Hot-first ordering · schema-validated forms ·
accessibility conformance on critical flows · quick-log actions · deals in global search.

**Complexity.** XL

---

## Phase 7 — Honesty, Performance & Cleanup

**Goal.** Bring the CRM within the project's structural limits and inside its stated
response-time budgets.

**Business value.** REQ094–REQ096 are contractual. The oversized board file is the
project's largest single review and regression risk.

**Technical scope.**
1. Decompose the board page to within the project's component and page limits. Behaviour
   preserved; this is not a redesign. *(TD-1)*
2. Move direct storage access out of components into the data layer; delete dead code.
   *(TD-4)*
3. Optimistic board updates with rollback, plus background refresh. *(AD-11)*
4. Verify list rendering, query shape, and payload size against the two-second budgets.
   Virtualise only where measurement shows it is needed.
5. Correct stale statements in steering documents, including entity counts.

**Dependencies.** All prior phases. Decomposing before behaviour settles means doing it twice.

**Risks.**

| Risk | Mitigation |
|---|---|
| Decomposition silently changes behaviour | Pure structural refactor, no behavioural change in the same commit. E2E coverage of board flows first. |
| Optimistic updates mask server rejections | Rollback with an explicit error toast; never leave the client showing a state the server refused |
| Performance work is speculative | Measure before optimising. No virtualisation, memoisation, or caching without a recorded measurement justifying it. |

**Validation checklist.**
- [ ] No CRM file exceeds its project size limit
- [ ] No component or hook accesses browser storage directly
- [ ] A rejected optimistic move rolls back and surfaces an error
- [ ] Record retrieval and mutation meet the two-second budget under representative data
- [ ] Every optimisation cites a measurement
- [ ] Steering documents match the codebase
- [ ] Full regression suite green; type check clean

**Deliverables.** Decomposed board within limits · storage access confined to the data
layer · optimistic updates with rollback · measured performance conformance · corrected
steering.

**Complexity.** L

---

## 4. Definition of Done — Every Phase

No phase is complete until all of the following hold.

- [ ] Type check passes with zero errors
- [ ] Production build succeeds
- [ ] Regression suite green — no previously passing test broken
- [ ] Tenant isolation test added for every new query path
- [ ] Audit-write test added for every new mutation
- [ ] Permission test triad added for every new guarded surface: has permission, lacks permission, Client Admin
- [ ] Every new UI element carries paired dark-mode classes
- [ ] Every new data surface renders loading, empty, error, and populated states
- [ ] Blueprint conformance checklist (§13) passes
- [ ] Audit report updated — closed findings struck, newly discovered findings added
- [ ] Blueprint decision log updated with any decision taken during the phase
- [ ] No new stop condition triggered and left unresolved

---

## 5. Explicitly Not Scheduled

Not deferred through oversight. Each is excluded for a stated reason in the blueprint (§12).

Separate Lead, Customer, or Account tables · real-time transport · automated lead-score
computation · user-defined custom fields · field-level permissions · mailbox
synchronisation · payment processing · a separate ticketing entity.

---

## 6. Open Items Blocking Start

| Item | Blocks | Needed from |
|---|---|---|
| **AD-4 sign-off** — does the five-stage ceiling count won and lost? | Phase 5 template seeding | Product |
| Roadmap consistency review against current architecture | Phase 1 start | Engineering |
| Lifecycle backfill mapping review | Phase 2 | Product + Engineering |

Phase 1 item 1 (tenant-scoped stage resolution) is a live security defect and is **not**
gated on these reviews.
