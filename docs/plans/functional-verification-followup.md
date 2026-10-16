# Functional verification follow-up

This follow-up builds on the merged [functional audit corrections](functional-audit-fixes.md). It preserves tenant isolation, permission checks, Deal-based Task associations, Account creation receipts and conversion transactions.

## Application corrections

| Area | Problem | Correction and acceptance |
| --- | --- | --- |
| CRM create/edit panels | Some native controls, nested Account fields and conversion choices were missing from the existing dirty/busy close policy. | Register those drafts with the shared guard. Cancel, Escape and close must preserve edits until discard is confirmed; pending saves/uploads block closing. |
| CRM submissions | A second submit could complete validation while the first save was pending and clear the form library's submitting flag. | Keep a separate save state and synchronous submission lock. One pending write stays locked, errors retain input, and an explicit retry retains its creation identity. |
| Lead refresh | Refreshing the same record object could reset an unfinished form. | Reset on record identity changes; same-record refreshes preserve a draft. |
| Contact phone | Submit did not apply the existing Philippine mobile input validation. | Reject invalid local input before saving, retain the entered number and show the field message. |
| Shared Task Details | Fetched data could enable fields before the draft initialization effect ran. An immediate status change could be overwritten, and Save could close with no write. | Keep fields disabled until the matching draft is initialized. Pristine drafts absorb newer fetched versions before editing resumes; dirty drafts retain conflict protection. Verify the first loaded frame and actual completion persistence from Deal Details. |
| Mailbox shutdown | Stopping the scheduler cleared its timer without awaiting active synchronization/scheduled-send work. | Stop new iterations and await both jobs. Server shutdown and fixtures await the stop callback; durable leases remain the recovery mechanism if the existing process shutdown deadline expires. |
| Development watcher | The old watcher retained vulnerable development dependencies. | Use supported Node watch mode with the existing `ts-node` hook. Verify dependency reload and actual development startup; retain `ts-node` for other scripts. |

The [Task editor](../../frontend/src/features/tenant/operations/tasks/ui/task-editor.tsx), [organization fields](../../frontend/src/shared/components/crm/organization-fields.tsx), [CRM forms](../../frontend/src/features/tenant/crm) and [mailbox scheduler](../../backend/src/integrations/gmail/mailbox-sync.service.ts) retain the existing module boundaries. This follow-up introduces no public HTTP contract or database schema change.

## Verification harness

- Fixtures allocate independent loopback ports and use the existing production build where a shared development output directory previously caused interference.
- Real-proxy fixtures use a disposable local TLS gateway, preserving production origin checks. Provider traffic remains blocked; certificate files and databases stay in ignored output.
- Fixtures use supported workflow triggers, eligible owners, structured workflow snapshots, protected native groups, scoped labels and actual confirmation behavior. Fixture repair is recorded separately from an application fix.
- Native database removal retries temporary filesystem locks after guarded shutdown. A failed removal remains retryable. Cleanup errors are recorded and remaining browser suites continue; running clusters are never deleted.
- Touch tests pause edge scrolling before measuring and can steer back after an overshoot. They still require real auto-scroll and database persistence. Transport failures remain visible, and failure reports are written before screenshot cleanup.
- Mailbox-activity acceptance uses the existing native PostgreSQL runtime for concurrent worker/SSE/authorization flows, after the single-connection PGlite bridge became unreachable during a longer run. It verifies scheduled message/Activity persistence in SQL before applying its separate UI deadline. The worker still discovers mail naturally; the fixture does not force a browser refresh or bypass the scheduler.
- Run resource-intensive browser groups with enough available memory. Preserve failed/aborted reports separately from final reruns. Revalidate changed fixtures and their dependencies instead of silently treating earlier results as final.

## Repeatable acceptance

Use the existing isolated harness; it clears production credentials, blocks external messaging and creates disposable databases. Unit selection supports a workspace; its browser/integration `--filter` does not select individual unit files.

```sh
npm run qa:typecheck
npm test -- --workspace=frontend
npm test -- --workspace=backend
npm run qa:build
npm run test:browser
npm run test:browser -- --filter=verify-tasks-browser.mjs
npm run test:integration:native -- --filter=mailbox-agent
node --test scripts/qa-safety.test.cjs scripts/qa-ci.test.cjs scripts/deploy-coolify.test.mjs
node --test backend/scripts/verify-dev-watcher.test.cjs
npm run qa:docs
npm audit
```

The existing QA runner writes revision/source fingerprints, statuses, counts and diagnostic paths to ignored `data/outputs/system-audit/`. Review the actual [PR #155 checks](https://github.com/reymarkjpanes/LeadCRM/pull/155/checks) and final task report for the proposed revision. A configured workflow or a previous passing revision is not a current passing result.

[CI/release guidance](../setup/ci-coolify-release.md) describes the five active checks and manual deployment boundary. Branch protection currently requires the three TypeScript checks; the unit jobs are additional checks. This change does not modify repository protection settings or add automatic deployment.

## Remaining production boundaries

Read-only production health inspection and provider history do not prove physical SMS delivery, webhook signing-secret equality, live OAuth recovery or private backup restoration. Keep unknown/unconfirmed SMS outcomes unresolved until genuine provider evidence is available. Correlating a specific incident with its CRM database row is a separate check.

Verification does not deploy, send live SMS/email, change production data, or make purchases/payments. Physical-device, screen-reader, zoom/PWA and unexecuted integration scenarios remain explicit coverage gaps. Retain the migration compatibility and recovery rules from the first fix release when planning any later deployment.
