# Workflow automation audit and architecture decision

Date: 2026-09-22. Scope: existing automation module, its CRM emitters and browser consumers. Implementation and verification results are tracked below; this audit is not a claim of completion.

| Area | Current implementation | Problem | Severity | Recommended fix |
| --- | --- | --- | --- | --- |
| Contracts | Backend `isActive`, structured conditions; UI `status`, string conditions, legacy action/delay | Saved workflows differ from displayed workflows | P0 | Shared canonical DTO and one builder |
| Conditions | Emitters use literal dotted keys; evaluator traverses nested objects | Matching conditions fail | P0 | Deliberately flattened context; regression tests before fix |
| Execution | DataContext executes after real API mutations | Duplicate browser/server effects and local-only history | P0 | Remove browser execution; mock editing remains available |
| Field update | Arbitrary Prisma field writes; contact maps to Lead | Protected Status and ownership can be changed without domain checks | P0 | Entity-specific allowlist and domain services |
| Email | `send_email` returns `queued: true` without delivery | False successful runs | P0 | Existing Gmail transport, real delivery log, safe failures |
| Domain side effects | Stage action invokes repository and recreates partial side effects | Bypasses service required-field/lost-reason validation; invalid actor FK | P0 | Governed stage service, actual tenant user actor, loop guard |
| References | No activation reference validation | Cross-tenant users/templates/stages can be configured | P0 | Tenant/environment reference checks on activation and execution |
| Triggers | Lead service emits both Lead and Contact events; catalog advertises unwired task/campaign events | Ambiguous entity identity and dead options | P1 | Lead events from Lead service; Contact events from Contact service; only emitted metadata |
| Runs | Trigger/run/steps exist; no workflow timeline activity; malformed conditions swallowed | Missing observability, browser history disconnected | P1 | Persist skipped/failed runs, safe errors and Activity; lazy API runs |
| Activation | CRUD accepts arbitrary trigger/config; toggle does no validation | Invalid active workflows | P1 | Strict validation on activation and edits to active workflows |
| Permissions | API named permissions; UI legacy p13–p16 | Inconsistent controls; create/update can set active without separate guard | P1 | Existing userCan and authorize; activation gate on all active writes |
| Scheduler/SMS | Campaign scheduler uses stub senders; no durable workflow steps | Browser delay promises persistence it cannot provide | P1 | Remove delay and unsupported SMS controls |
| UI | Two editors, fake test, invented hours saved, hardcoded catalogs | Competing payloads and misleading feedback | P2 | One guided WHEN/IF/THEN form, metadata, server dry-run, measured state |
| Archive | Backend soft archive deactivates | Existing good behavior to preserve | — | Preserve history and reject archived activation |
| Environment | AsyncLocalStorage + Prisma middleware already scopes CRM | Engine must retain request/job scope and reject absent/mismatched scope | P0 | Reuse environment architecture; no second scoping mechanism |

## Context analysis

Backend dependencies: automation routes → controller → workflow service/repository; CRM Lead/Contact/Deal services → trigger helpers → engine. Actions depend on tasks, notifications, Gmail and governed CRM mutation services. Frontend dependencies: DataContext owns workflow list; workflow page/editor/recipes/history and CRM timeline consume legacy types. Shared contract changes require updating these consumers together. Risk: HIGH (business side effects and shared state), mitigated by allowlists, fail-closed validation and tests.

## Architecture decision

Option A: introduce a new queue, graph engine and schema. Rejected: unnecessary scope and competing infrastructure. Option B (selected): extend the current engine, tables and service boundaries. One `Workflow` contract uses `isActive`, `conditions: {operator, conditions}`, and ordered `actions: [{type, config}]`. Event contexts use literal dotted keys only, defined in trigger metadata. Existing CRUD routes remain; add read-only backend dry-run. Frontend uses the existing DataContext list owner and a cached metadata path. Runs load on demand. Mock mode supports canonical fixture CRUD and explicitly does not simulate real delivery.

Execution path: domain mutation → one correctly named event → environment-scoped engine → TriggerRecord → Run → ordered Step(s) → workflow Activity. Domain actions reuse existing services. Chain-local workflow IDs and depth cap prevent recursive re-entry. No retries that could duplicate external side effects. No durable delayed execution is claimed.

Retain: workflow routes/controller/service/repository/engine, existing shared contract and API client. Consolidate: duplicate feature API client, two editors, recipe formats, browser condition/action engine and fake history. No destructive database commands or entity redesign.
