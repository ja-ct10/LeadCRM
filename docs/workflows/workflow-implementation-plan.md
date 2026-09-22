# Workflow implementation and deployment plan

Status: in progress — NOT approved for deployment.

## Selected approach

Extend the existing backend engine and services. Keep the current database models and environment scoping. Use one shared Workflow contract, server metadata, one guided WHEN/IF/THEN builder and API-backed Runs. Implement six immediate actions only. Remove unsupported SMS, delays, fake tests/metrics and browser execution. Retain mock fixture editing without pretending it performs server automation. See [audit](workflow-automation-audit.md).

## Ordered work and exit gates

1. **Audit and dependency map** — trace frontend, engine, emitters, domain services, delivery, permissions and environment. Capture all P0/P1 issues before implementation. Gate: coherent findings and architecture decision. Done for the principal runtime paths; further discoveries remain in scope.
2. **Regression tests** — first reproduce flattened-context failures, protected status writes and false email success. Gate: tests fail for the actual defect before the fix.
3. **Canonical contracts and validation** — shared draft/condition/action/run/metadata types; strict activation; scoped users/templates/stages; archived activation blocked; no activation permission bypass through CRUD. Gate: invalid inputs and cross-tenant references rejected with actionable errors.
4. **Backend correctness** — consistent flattened events, correct Lead/Contact identity, real actions through services, status allowlist, governed stages, recursion guard, truthful run/step/activity records, safe error text. Gate: all supported actions have passing tests and no fake-success path.
5. **Frontend integration** — one builder and canonical recipes, cached server metadata, existing shared list owner, real toggle/archive/duplicate/test/runs, named permissions, accessible dialogs, explicit loading/errors. Gate: no old production shape or browser engine remains; successful mutation feedback follows server success.
6. **Data compatibility** — inspect old stored definitions without destructive reseeding; preserve history; report invalid legacy workflows and require correction before activation. Update fixtures and seed source only. Gate: existing data preserved and unsupported definitions cannot execute.
7. **Automated validation** — targeted regression/security/service tests, disposable-dataset integration tests, repository lint and build, then full relevant suites. Gate: failures introduced by the change fixed; existing failures recorded precisely.
8. **Manual acceptance** — real stack Lead→Task; conditional Deal→Notification match/nonmatch; governed stage transition; provider-stub failure without customer email; role access; tenant/environment isolation; every visible workflow control; mobile/desktop/dark/keyboard. Gate: evidence recorded, no console errors during tested flows.
9. **Release review** — review final diff, verify migration requirements, provider configuration, production mock flags, staging smoke results and rollback. Gate: all applicable definition-of-done items verified. Unavailable infrastructure is a blocker, never a passing result.

## Deployment and rollback

Prepare and validate locally first; no automatic production deployment is part of readiness verification. Build frontend and backend from the same revision because the workflow API shape is shared. Do not reset, truncate or reseed an existing database. Take the deployment platform's normal backup before any explicitly required additive migration. Start in staging with external sends disabled; use safe provider stubs and disposable tenant fixtures for acceptance.

Pause workflows if duplicate actions, cross-environment access, incorrect Status mutations or false successful deliveries occur. Roll back the coordinated application release to the previous artifact; preserve all execution history for diagnosis. Do not replay failed runs automatically because external side effects may already have occurred. Deployment readiness remains false until the evidence below is complete.

## Validation evidence

Pending implementation and execution. Commands/results, tested scenarios and infrastructure blockers will be recorded here as work proceeds.
