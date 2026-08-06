# LeadCRM — CRM Architecture Blueprint

**Status:** Living document · **Last revised:** 2026-08-07
**Question this document answers:** *What should the CRM become?*

> This document describes target architecture: entities, relationships, lifecycles,
> boundaries, permissions, and journeys. It deliberately avoids file paths, column
> names, and API shapes except where a name *is* the decision. Sequencing lives in
> `crm-engineering-roadmap.md`. Current defects live in `crm-audit-report.md`.

---

## 1. CRM Principles

These are the constraints every design decision in this document is measured against.

1. **One record per real-world thing.** A person is one record for their whole
   lifecycle. A company is one record. Lifecycle position is an attribute, never a
   separate table. Conversion moves a field, it does not copy a row.
2. **Relationships are structural, not textual.** If two entities are related, that
   relation is a foreign key or a junction row. A typed-in company name is not a
   relationship.
3. **One governed path per state transition.** Every meaningful state change has
   exactly one entry point that owns its side effects. Alternate write paths that
   skip those side effects are defects, not shortcuts.
4. **Humans own judgement; the system owns facts.** Relationship temperature is a
   human assessment and is never overwritten by automation. Lifecycle position is a
   derived fact and is maintained by the system.
5. **Never display a number the system did not measure.** Absent data renders an
   empty state. Fabricated defaults are worse than blank.
6. **Tenant scope is proven, not assumed.** Every read and write resolves ownership
   from the authenticated session. Records that fail the ownership test do not exist,
   and the API says so with 404.
7. **Extend before adding.** A new module is justified only when no existing module
   covers the concept. Renaming, view-filtering, and adding a field are all preferred
   to creating a parallel entity.
8. **Automation is visible and real, or it is absent.** Simulated behaviour is not a
   placeholder; it is a false claim about the product.

---

## 2. Canonical Vocabulary

Terminology is fixed here because the audit found the same concept named three
different ways across UI, types, and database.

| Domain concept | Persisted as | UI label | Notes |
|---|---|---|---|
| A person | Contact entity | **Client Profile** | Master record — the "Bible". Label is mandated by requirements §2. |
| A company | Organization entity | **Account** | Presentation and API rename only. The persisted model name does not change. |
| An opportunity | Deal entity | **Deal** | Also surfaced as "Ticket" in support-type pipelines. |
| A process | Pipeline + Stage | **Pipeline** | Four business-purpose pipelines, per REQ132. |
| Relationship temperature | Contact status | **Status** | Human-owned. Hot / Warm / Cold / Cancelled / Closed. Never automated. |
| Lifecycle position | Contact lifecycle stage | **Lifecycle** | System-owned. Lead → Contact → Customer, etc. |
| Record kind | Contact record type | **Type** | Individual or Organization. Drives conditional field visibility (REQ134). |
| Customer standing | Contact/Org customer type | **Customer standing** | Prospect / Active / Inactive / Former. Set by the won-deal handoff. |

**Naming rule going forward:** the persisted name, the type name, and the UI label
for a concept may differ, but each must appear exactly once per layer. Two nav arrays
describing the same sidebar, or two fields encoding the same idea, are architecture bugs.

---

## 3. Entity Model

### 3.1 Three tables, five views

The CRM introduces **no new core entities**. Leads, Contacts, and Customers are
filtered views over one table.

```
Account       = Organization   (presentation rename)
Client Profile= Contact        (+ lifecycle, + record type)
Deal          = Deal           (+ mandatory Account link)
```

| View | Backed by | Scope |
|---|---|---|
| **Leads** | Contact | lifecycle ∈ { Lead, Qualified } |
| **Client Profiles** | Contact | all non-archived — the master database |
| **Customers** | Contact + Account | customer standing = Active |
| **Accounts** | Organization | all non-archived |
| **Deals** | Deal | all non-archived |

Why views rather than tables: one search index, one permission surface per entity,
one adapter set, no lossy conversion, no duplicate records, and no risk of a person
existing twice with divergent history.

### 3.2 Field responsibilities on a Client Profile

The audit's root cause 3 is one field carrying three meanings. The target separates them
into four independent axes, each with a single owner:

| Axis | Owner | Changed by | Never changed by |
|---|---|---|---|
| **Status** (Hot/Warm/Cold/Cancelled/Closed) | Human | Explicit user action with confirmation | Deal movement, workflows, imports |
| **Lifecycle** (Lead/Qualified/Contact/Customer/Churned/Disqualified) | System | Conversion, won-deal handoff, explicit disqualify | Free-text edit |
| **Record type** (Individual/Organization) | Human | Set at creation, editable | Automation |
| **Customer standing** (Prospect/Active/Inactive/Former) | System | Won-deal handoff, churn workflow | Free-text edit |

This satisfies REQ131 by construction: the automated axes and the locked axis are
different fields, so no automation can reach Status. It also resolves the
Individual/Organization overload without deleting any existing enum value, which
keeps RC-1 compliant and avoids a destructive data migration.

### 3.3 Stage governance

Stages gain three responsibilities beyond ordering:

- **Terminal classification** — won and lost are flags on the stage, and flags are the
  only authoritative source. Stage names are display strings and must never be parsed.
- **Entry requirements** — a stage may declare which deal fields must be populated
  before a deal may enter it. This is the mechanism REQ089 requires, enforced
  server-side with the client mirroring it for immediate feedback.
- **Staleness threshold** — a stage may declare after how long a resident deal is
  considered rotten, so follow-up can be triggered rather than remembered.

Stages also gain direct tenant ownership so that no query needs a join to prove scope.
Ownership remains *derived* from the parent pipeline — it is written at creation and is
not independently editable, so the two can never disagree.

---

## 4. Relationship Model

```
                    Account
                   /        \
          1 ── many          1 ── many
         /                            \
   Client Profile ── many ── many ── Deal
                  (junction, with role)
```

| Relationship | Cardinality | Rule |
|---|---|---|
| Account → Client Profile | 1 : many | Optional. An individual client may have no Account. |
| Account → Deal | 1 : many | **Mandatory for new deals.** Every opportunity belongs to an Account. |
| Deal ↔ Client Profile | many : many | Via junction with a role (Primary, Decision Maker, Technical, Billing). Every deal has exactly one Primary. |
| Deal → Stage history | 1 : many | Append-only. One row per transition, forever. |
| Deal → Activity | 1 : many | Unified timeline. |
| Client Profile → Task, Activity, Campaign membership | 1 : many | Existing. |

**Why Account is mandatory on Deals.** Forecasting, account-level revenue, customer
handoff, and territory reporting all read through the Account. A deal without one is
invisible to all four. The database keeps the column nullable so historical rows survive;
the write contract requires it. Individual clients without a company are handled by an
Account of record type Individual, not by a null.

**Legacy singular contact link.** The one-to-one deal-to-contact FK is superseded by the
junction and is read-only legacy. New code uses the junction exclusively; the legacy
column is retired only after a verified backfill.

---

## 5. Lifecycle Model

### 5.1 Client Profile lifecycle

```
   ┌────────┐  qualify   ┌───────────┐  convert  ┌─────────┐  deal won  ┌──────────┐
   │  LEAD  │ ─────────▶ │ QUALIFIED │ ────────▶ │ CONTACT │ ─────────▶ │ CUSTOMER │
   └────────┘            └───────────┘           └─────────┘            └──────────┘
        │                      │                      │                      │
        │ disqualify           │ disqualify           │ churn                │ churn
        ▼                      ▼                      ▼                      ▼
  ┌──────────────┐      ┌──────────────┐        ┌─────────┐            ┌─────────┐
  │ DISQUALIFIED │      │ DISQUALIFIED │        │ CHURNED │            │ CHURNED │
  └──────────────┘      └──────────────┘        └─────────┘            └─────────┘
```

Transition rules:

| From | To | Trigger | Requires |
|---|---|---|---|
| Lead | Qualified | Human, in the convert flow | — |
| Qualified | Contact | Conversion transaction completes | Account linked |
| Contact | Customer | Won-deal handoff | Deal in a won stage |
| Any | Disqualified | Human, explicit | A reason, recorded |
| Customer | Churned | Human, or all-deals-lost workflow | — |
| Churned | Contact | Human, re-engagement | — |

A lost deal does **not** regress lifecycle. The person stays a Contact and remains
available for a future opportunity. Losing an opportunity is not losing a relationship.

Status is absent from this diagram on purpose. It moves independently, by human action only.

### 5.2 Deal lifecycle

A deal's lifecycle *is* its stage sequence, so it is defined per pipeline rather than
globally. Two invariants hold for every pipeline:

- Exactly one stage is the default entry stage.
- At least one won stage and at least one lost stage exist, both flagged.

Every transition, without exception, produces: the stage change, one append-only
history row, one timeline activity, one audit entry, and one workflow-trigger
evaluation. Five effects, one transaction, one entry point.

---

## 6. Pipeline Model

Per REQ132, four pipelines, each a maximum of five working stages.

| Pipeline | Purpose | Deal reads as |
|---|---|---|
| **Sales Inquiries** | New revenue opportunities | Deal |
| **Technical Support** | Reported faults and issues | Ticket |
| **Project Implementation** | Delivery of won work | Project |
| **After-Sales Concerns** | Post-delivery issues and retention | Case |

**Stage-count interpretation.** The five-stage ceiling applies to *working* stages —
those a deal actively occupies while in progress. The won and lost stages are terminal
system stages and are not counted, because they are outcomes rather than work states,
and because REQ132's stated intent is to prevent overly complex workflows. This
interpretation is recorded as decision **AD-4** and needs product sign-off before the
templates are seeded.

**Templates are server-owned.** Pipeline definitions live in one place on the server and
are consumed by both the seeder and the create-pipeline UI. The client never authors
stage semantics, which is what produced flagless pipelines in the current build.

**Pipeline boundary rule.** Per requirements §8, only clients with an active opportunity
appear on a pipeline board. The Client Profile database and the pipeline are different
surfaces answering different questions: *who do we know* versus *what is in flight*.

---

## 7. Automation Model

Automation is expressed as trigger → condition → action against the existing workflow
engine, never as bespoke code inside a page component.

| Trigger | Intent |
|---|---|
| Deal enters entry stage | Guarantee first contact happens — create a dated, owned task |
| Deal enters mid-funnel stage | Keep lifecycle accurate — advance the linked profile's lifecycle |
| Deal enters proposal stage | Prevent the most-dropped step — schedule a follow-up |
| Deal enters late stage | Give management visibility — notify the owner's manager |
| Deal enters won stage | Post-sale handoff — customer standing, lifecycle, delivery order, finance notice |
| Deal enters lost stage | Make losses analysable — require and record a reason |
| Deal exceeds stage staleness threshold | Prevent silent pipeline rot — create a re-engage-or-disqualify task |

Two hard rules:

- Automation never writes to a human-owned field (§3.2). The won-deal handoff may set
  customer standing and lifecycle; it may not set Status.
- Every execution produces its full record set — a run container, one step per action,
  and one timeline entry — or it produces nothing. Partial executions are not logged as
  success.

---

## 8. Tenant Boundaries

The existing model is correct and is preserved, not redesigned.

| Boundary | Rule |
|---|---|
| Session → tenant | Tenant identity comes from the authenticated session only. Request bodies, query strings, and headers are never trusted as a tenant source. |
| Every query | Filters on tenant. No exceptions, including lookups of referenced entities such as stages. |
| Referenced entities | Any ID arriving from a client is resolved *within* the tenant before use. An ID that resolves outside the tenant is treated as nonexistent. |
| Failure response | Cross-tenant access returns 404, never 403. Existence is not disclosed. |
| Audit | Every entry carries tenant, actor, entity, and a before/after changeset. |
| Platform administration | System Admin operates on a separate surface and never reads tenant CRM data. |

**Defence in depth for referenced entities.** Entities reachable only through a parent
(stages through pipelines) carry their own tenant ownership so that scope can be proven
without a join. Derived at creation, immutable thereafter.

---

## 9. Permission Model

Permissions are named, module-scoped, and identical on both sides of the wire.

| Module | Actions | Governs |
|---|---|---|
| `contacts` | view, create, edit, delete | Client Profiles, Leads, Customers views |
| `accounts` | view, create, edit, delete | Accounts — **new surface**, currently borrowed from `contacts` |
| `deals` | view, create, edit, delete | Deals, pipelines, stages |
| `activities` | view, create, edit, delete | Timeline entries across entities |

Rules:

- The frontend guard and the backend guard reference the **same** permission name.
  Opaque positional identifiers are retired; a UI that cannot name the permission it
  requires cannot be reviewed.
- No guard means no render. An action a user cannot perform is not shown disabled — it
  is absent.
- Client Admin bypass is explicit and singular, implemented in one place.
- Adding a module means registering its permission set and seeding role defaults in the
  same change. A module whose routes borrow another module's permissions is unfinished.

---

## 10. User Journeys

### 10.1 Inquiry to closed business

```
1  Lead arrives          → Client Profile, lifecycle Lead, status set by a human
2  Rep qualifies         → one Convert action, one dialog
                            → lifecycle advances, Account linked or created,
                              Deal opened in the entry stage, primary contact role set,
                              first history row, timeline entry, notification, audit entry
3  Deal progresses       → each transition emits its five effects
                            → entry requirements block advancement until data is adequate
                            → stale deals raise follow-up tasks instead of being forgotten
4  Deal won              → customer standing Active, lifecycle Customer,
                              optional delivery order, finance notified.
                              Status untouched — a human decides that.
5  Customer visible      → Customers view, with every linked profile and deal
```

Target interaction cost: **one dialog** for step 2, against three forms today.

### 10.2 Lost opportunity, retained relationship

```
1  Deal moves to lost    → reason required, recorded, analysable
2  Profile unchanged     → stays a Contact, keeps full history
3  Optional              → if every opportunity is closed out, flag for re-engagement
```

### 10.3 Support intake

```
1  Existing customer reports an issue
2  Ticket opens on the Technical Support pipeline, against the same Account
3  Resolution path is the same governed transition machinery as a sales deal
4  Timeline is unified — sales and support history on one Account
```

No separate ticketing entity. A ticket is a deal on a support pipeline, which is why
pipeline type exists.

### 10.4 Where clicks are removed

| Today | Target |
|---|---|
| Type company name, leave, create Account, reconcile | Account picker with inline create |
| Three forms to qualify a lead | One convert dialog, one transaction |
| Open drawer, find tab, fill form, submit to log a call | Quick-log actions on the drawer's first tab |
| Stage change impossible from the table | Stage control in the row, keyboard reachable |
| Deal unreachable except by browsing the board | Deal reachable from global search |

---

## 11. Decision Log

Architectural decisions taken while writing this blueprint, with reasoning, per the
project rule that decisions are documented before implementation.

**AD-1 — Lifecycle is a field on Contact, not a separate Lead entity.**
A separate table means duplicate people, lossy conversion, two search indexes, and two
permission surfaces. A field means conversion is a state change with full history
retained. Adopted.

**AD-2 — Account is a presentation and API rename of Organization, not a schema rename.**
Renaming the persisted model cascades into every query, relation, and import for a label
change. The API route and every UI label change; the model name does not. Cost/benefit is
decisive. Adopted.

**AD-3 — `ContactStatus` keeps all five existing values; lifecycle is added alongside.**
This reverses the earlier proposal to delete Cancelled and Closed. REQ131 names those five
as the human-owned set (RC-1), and deleting enum values forces a destructive data
migration for no gain. Adding a separate system-owned lifecycle axis achieves the
separation *and* satisfies the requirement *and* avoids the migration. Strictly better on
all three counts.

**AD-4 — The five-stage ceiling counts working stages; terminal stages are additional.**
REQ132's intent is to prevent complex workflows. Won and lost are outcomes, not work
states, and every pipeline needs both to function. Counting them would leave three usable
stages. **Requires product sign-off before templates are seeded.**

**AD-5 — Master-record terminology stays "Client Profiles".**
Requirements §2 fixes it. Leads and Customers become views over the same module rather
than renames of it (RC-3).

**AD-6 — Account is required by the write contract, nullable in storage.**
Enforcing at the contract layer stops the bleeding immediately; keeping storage nullable
lets existing rows survive until backfilled. Column nullability tightens only after
backfill is verified.

**AD-7 — Won/lost is determined by flags only. Names are display strings.**
Substring matching on names breaks under renaming and localisation, and the flags already
exist. No exceptions, including in forecast maths.

**AD-8 — One governed transition path; the ungoverned one is closed, not deprecated.**
Stage change is removed from the general update contract rather than merely discouraged.
An alternate path that skips side effects will be used by accident.

**AD-9 — Deals unify into one module with multiple views.**
Two parallel deal modules (NAV-2) is duplication, not choice. Board, table, and forecast
become views over shared data and shared logic. The retired route redirects for one
release.

**AD-10 — Navigation is defined exactly once.**
Sidebar, command palette, and route map read from a single registry with permissions
attached. Three copies is why modules went missing (NAV-1).

**AD-11 — No real-time transport.**
Optimistic updates with rollback plus background refetch covers realistic collision rates
at 16–50 concurrent users (REQ066, REQ096). Server-sent events are the cheaper escalation
if evidence demands it. WebSockets are not justified.

**AD-12 — Support tickets are deals on a support pipeline.**
A separate ticket entity would duplicate stage machinery, history, activities, and
permissions to model the same shape. Pipeline type already distinguishes them.

---

## 12. Out of Scope

| Item | Reason |
|---|---|
| Separate Lead / Customer / Account tables | AD-1, AD-2. Duplicates records and forks the relationship graph. |
| Real-time collaborative transport | AD-11. Not justified at target concurrency. |
| Automated lead-score computation | Score and its temperature mapping already exist. Automating the calculation is a distinct feature with its own requirements. |
| User-defined custom fields and field-level permissions | Legitimate CRM capability, premature before core relationships are populated. |
| Mailbox synchronisation | Separate workstream with its own integration surface. |
| Payment processing | Billing domain, not CRM. |
| Separate ticketing entity | AD-12. |

---

## 13. Conformance Checklist

A CRM change conforms to this blueprint when all of the following hold.

- [ ] No new entity was introduced for a concept an existing entity already covers.
- [ ] Every relationship it creates is a key or junction row, never a typed string.
- [ ] Every state transition it adds routes through that state's single governed path.
- [ ] It writes to no human-owned field from automation.
- [ ] Every query it adds resolves tenant from the session and filters on it.
- [ ] Any client-supplied entity ID is resolved within the tenant before use.
- [ ] Cross-tenant misses return 404.
- [ ] Every mutation writes an audit entry with a changeset.
- [ ] Every create/edit/delete surface is guarded by a named permission matching the backend.
- [ ] Terminal stage semantics are read from flags, never from names.
- [ ] Every data surface renders loading, empty, error, and populated states.
- [ ] No displayed metric is fabricated when its source data is absent.
- [ ] The concept it touches is named once per layer — no second nav array, no second field.
