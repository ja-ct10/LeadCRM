# Dashboard reporting definitions

Dashboard, CSV and compatibility endpoints use `dashboard.service.ts` and the shared Dashboard contract. Browser collection loaders are not analytics sources. Each report is a repeatable-read snapshot; access is checked again before release.

## Authorization and population

The authenticated session supplies workspace/user. `dashboard.view` is mandatory. Module `deals.view`, `leads.view`, `tasks.view` grants enable dependent report data. Client Admin receives organization scope. Other roles, including custom roles, receive currently assigned records. Unauthorized metrics are unavailable, rather than zero. CSV and streams enforce current authorization.

Eligible Deals belong to the one active **Sales Pipeline**, are unarchived and not deleted. Authoritative Stage rows must have ordered names Lead, Contacted, Qualified, Closed Won, Closed Lost and matching terminal flags. IDs, order, configured probabilities and colors come from these rows. Ambiguous/invalid configuration returns 409 without rewriting history. Other pipelines are excluded with a warning.

Eligible Leads are unconverted, unarchived and not deleted, separate from the Deals pipeline's Lead stage.

## Dates

Default: This Month. Inclusive dates use Asia/Manila, converted to half-open UTC `[start midnight, day after end midnight)`.

| Option | Inclusive calendar interval |
| --- | --- |
| Today | Today |
| Last 7 / 30 Days | Today and preceding 6 / 29 days |
| This Month | First day of this month through today |
| Last Month | Entire previous calendar month |
| Last 3 / 6 Months | First day two / five calendar months ago through today |
| This Year | January 1 through today |
| Custom | Valid ordered start and end, maximum 732 days |

Daily buckets apply up to 93 days; longer intervals use months. Empty successful buckets are zero. Query failures do not produce empty reports. Prisma timestamps store UTC without timezone; SQL explicitly casts input boundaries to UTC and groups closing dates in Manila.

## KPIs and charts

| Metric | Formula and time basis |
| --- | --- |
| Total Revenue | Sum tenant-currency amounts of currently Closed Won eligible Deals with valid `closedAt` in period |
| Revenue Trend | Identical revenue grouped by `closedAt`; sum reconciles with Total Revenue |
| Forecasted Revenue | Current open amount × configured Stage probability / 100, summed; expectedCloseDate does not narrow current forecast |
| Active Deals | Distinct currently Lead, Contacted or Qualified Deals |
| Total Leads | Current eligible Leads-module population |
| Win Rate | Period Won / (Won + Lost) × 100; no outcomes means unavailable |
| Average Deal Velocity | Mean fractional days from creation to eligible period Won closure, rounded to one decimal; no wins means unavailable |
| Won vs. Lost | Current terminal outcomes grouped by valid `closedAt`, matching Win Rate population |
| Pipeline Distribution | Current counts in three official open stages; sum equals Active Deals |
| Pipeline Value by Stage | Current tenant-currency open amounts in those stages; sum equals Open Pipeline Value |

Valid closure means `createdAt <= closedAt <= generatedAt`. Missing/invalid closing timestamps are excluded and disclosed. Repeated same-stage closure preserves one timestamp and transition. Existing rules prohibit reopening Won; never-won Lost Deals may reopen into Qualified. Reopening clears `closedAt`, removes period outcome and restores current pipeline. Historical Lost milestones remain in conversion history.

Currencies are never converted or mixed. Money uses tenant currency (PHP when unset); other/unknown currencies are excluded and warned, while counts remain currency-independent. Reporting normalizes each stored amount to two decimal places before summing, consistent with the Product price contract and currency presentation. This keeps bucket/stage sums reconciled even for legacy Float values with extra precision; stored amounts are not rewritten. Negative/nonfinite/missing same-currency amounts make affected monetary totals unavailable. Missing/invalid probability makes forecast unavailable. Configured zero is valid, never replaced with invented probability. Existing CRM APIs protect immutable Product/value snapshots; subscriptions also cover committed integration/database corrections.

## Deal Pipeline Conversion Funnel

Cohort: eligible, currently visible Deals **created in the selected interval**. Milestones count distinct Deals with actual `DealStageHistory.newStageId` events from creation through report generation. Current stage alone is not proof. Verified start has null previous stage and timestamp matching creation. The migration records future starts with a valid actor/owner/assignee. Old events are never reconstructed.

Open milestones are Lead → Contacted → Qualified. Won and Lost are separate branches. Repeated/backward/reopened transitions count each milestone once; skipped stages are not inferred.

Rates use intersections: Lead-and-Contacted / Lead; Contacted-and-Qualified / Contacted; Qualified-and-Won / Qualified; Qualified-and-Lost / Qualified. These describe cohort milestone attainment, not strict consecutive movement order. If any cohort Deal lacks a verified start, counts show only recorded events and progression rates are unavailable. Empty denominators are unavailable.

## Sales Leaderboard

At first future transition into Won, the database captures assigned agent and eligibility in `revenueOwnerId` / `revenueOwnerEligible`. Eligibility follows active assignment rules: non-administrative, non-Guest with actual active-role Lead and Deal view/edit grants. Reassignment cannot rewrite captured achievement. Deactivated agents retain credit. Legacy unknown attribution is disclosed and omitted, without guessing from mutable `ownerId`.

Revenue uses the same period/currency eligibility as Total Revenue. Rank: revenue descending, won count descending, stable user ID; top five. Staff see currently authorized assigned Deals credited to themselves. Organization revenue may exceed leaderboard sums when historical attribution is unknown or administrative/ineligible.

## Action Center

Current nonarchived tasks exclude completed/cancelled; earliest due dates come first and overdue precedes other actions. Display is bounded to six tasks, three eligible Hot Leads and three open Deals exceeding official stage `rottenAfterDays`. Qualifying action count controls empty state. Existing taskboard/CRM routes are destinations. Contacts, Accounts, Inbox and Campaigns have no synthetic metric; their existing actions update Dashboard when they mutate supported Task/Lead/Deal records.

## Automatic updates and recovery

Database triggers update tenant revisions in the same transaction as Deal/Stage/Pipeline/history, Lead, Task and access changes. Rollback removes counter changes. Counters survive replica/process restarts. This extends existing bounded Inbox SSE, without another event service.

Streams observe committed counters every three seconds, heartbeat and end at 45 seconds. EventSource reconnects after three seconds. Sessions/RBAC are revalidated every observation; payloads contain counters only. Next preserves streaming/no-buffer headers. Auth access subscriptions remain outside module guards so revocation and later grants refresh existing permissions.

The hook batches bursts, refreshes authoritative aggregates on connection/reconnect/focus/wake/online, and reconciles every 30 seconds while foregrounded. Request generation/cancellation prevent stale identity/filter responses. Disconnection/error marks displayed data stale; access loss clears it. No frontend metric persistence or incremental event arithmetic. Sync Metrics is a read-only fallback. CSV takes a fresh authorized snapshot using identical definitions, labels time bases and escapes formula injection.

See [implementation evidence](dashboard-implementation-report.md), [API](API.md), [architecture](ARCHITECTURE.md) and [Coolify deployment](setup/coolify-production.md).
