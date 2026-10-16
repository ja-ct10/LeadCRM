# Functional audit corrections

Baseline: `3f271da9`. The audit tested `4229cb92`; the Account trigger permission correction and custom-field Forms/Details separation are already merged in this baseline. Keep those fixes and their security boundaries.

## Fix order and verification

| Stage | Changes | Dependencies | Acceptance evidence |
|---|---|---|---|
| 1. Verification harness | Register Workflow Policy browser runtime/output; update stale contract assertions and invalid fixtures without weakening business rules or migration guards. | Existing Vitest, native PostgreSQL and Playwright helpers. | Actual repository discovery succeeds; typechecks run; corrected fixtures exercise their remaining assertions. |
| 2. Account integrity and permissions | Share transaction-aware Account creation/receipts; preserve retry identity; validate new Accounts during conversion; support explicit optional-value clearing; close the Contact copy/search permission boundary. | Shared contracts, frontend serializers, backend services and existing receipts must change together. | Authenticated HTTP/SQL tests for retries, changed-intent conflicts, rollback, required fields, existing links, clearing, permission revocation and tenant isolation. Retain restricted database-role Account regression. |
| 3. Accurate lists and configuration | Apply Account system/related filters and aggregates before pagination; align native-group configuration with the existing canonical presentation rule. | Server-authorized facets/aggregates and shared layout validation. | Multi-page and >100-Deal fixtures; totals agree with returned scope; Settings cannot accept a layout that consumers silently override. |
| 4. Shared interaction | Add shared dirty/busy close protection; move Task Assign into the existing responsive Sheet shell; retain Task-specific state/cache/version rules and Workflow shared primitives. Add missing confirmed Account mutation feedback. | Existing confirmation, side-panel, selector and cache patterns. | Desktop/tablet/mobile containment; keyboard/focus/close behavior; cancel writes nothing; loading prevents repeats; errors keep input; retry persists; refreshed assignee/details agree across modules. |
| 5. SMS and documentation | Preserve sanitized provider diagnostics; expose unresolved/review outcomes and a bounded verification path without guessing delivery or resending uncertain messages. Gate disconnected mailbox event retries; update stale Help articles. | Existing signed TextBee callbacks, batch lookup, campaign evidence writer and authorization. | Mock-provider HTTP/SQL cases for accepted/sent/delivered/failed/unknown, duplicate/out-of-order evidence, old pending rows and missing batch identity; report/list agree after refresh. No live SMS/email during automated verification. |
| 6. Final verification | Run lint/typechecks, affected integration/component suites, shared/backend/frontend builds and focused browser journeys; then broaden checks when changes or failures justify it. | Completed stages and disposable fixtures. | Record exact revision, passing/failed/blocked checks and remaining limits. Preserve existing records and private history boundaries. |

## Constraints

- Preserve tenant isolation, RBAC, Deal-only Task associations, serializable conversion, original sales history and guarded retirement rules.
- Reuse the existing API client, validation contracts, creation receipts, cache invalidation, Sheet styling and confirmation components.
- Production configuration/migration state may be inspected through Coolify. Test writes belong in fresh disposable databases. A merged correction alone is not evidence of deployment.
- Keep unconfirmed SMS outcomes visibly unconfirmed. Do not automatically resend a message whose delivery cannot be established.
- Retain the findings and original failed evidence separately from corrected test runs. Do not describe fixture repair as an application behavior fix.

## Implementation and release dependencies

The fixes are implemented locally on `codex/leadcrm-functional-fixes`; validation reports remain separate from the original audit. No production deployment or provider send is part of this verification.

- Account forms and conversion now use the same transaction-aware creation policy, required-field validation and tenant/actor/intent-bound receipt. The shared conversion contract, frontend and backend must ship together. An identical retry reuses its request identity; changed input after a committed request is a conflict, not another Account.
- `20261214000000_contact_company_provenance` adds provenance to Lead/Contact company snapshots and conservatively marks existing linked text. Historical unlinked text cannot be classified reliably. The migration preserves text and relationships, but linked independently entered text is conservatively protected by Accounts View until explicitly edited.
- `20261215000000_sms_provider_diagnostics` adds optional sanitized provider diagnostics. Both migrations are explicitly included in the existing guarded deployment allowlist. Private history and separately guarded retirement migrations retain their current protections.
- Quiesce legacy Lead/Contact writers during the provenance migration and switch to the matching backend before resuming writes. Otherwise an older writer can create an unmarked Account snapshot after the backfill. The privacy presenter, search, merge, conversion, Deal projections and Campaign audience rules must be released together.
- A rollback must retain provenance-aware writers and permission filtering. Keeping the added columns while restoring an older writer does not preserve the privacy correction. Do not drop columns or reverse the backfill as an automatic rollback.
- Use the existing [Coolify release workflow](../setup/ci-coolify-release.md) and [production setup](../setup/coolify-production.md) when a deployment is authorized. Check the serving revision, guarded migration ledger, worker health and read-only provider history before attributing a deployed symptom to local code.
- SMS verification expires after 30 days into an explicit review outcome; unconfirmed provider acceptance and unknown device outcomes are visible immediately. Late authenticated evidence can resolve the status. No uncertain SMS is automatically resent. TextBee `sent` is distinct from carrier-confirmed delivery.
- Disconnected Gmail streams stop. The Activity timeline has an explicit retry that expires the cursor cache, refreshes status and resumes the shared stream when connected, retaining filters and draft state.
- Compatible dependency updates remove the reported production advisories. The remaining development-only `ts-node-dev` → `chokidar` → `braces` advisory has no published fix in the audited dependency report; replacing the development watcher is a separate reviewed change.

## Evidence interpretation

The final verification report must identify the tested source and distinguish passing assertions from a run invalidated by source changes. Earlier failures and superseded runs stay available. The inventory and original checklist are audit snapshots; local fixes do not retroactively turn every original item into Passed. Live Coolify/provider correlation, external transports, full assistive-technology coverage and Windows symlink behavior retain their own blocked or untested status until directly verified.

## Verification results — 16 October 2026

| Check | Result | Scope and remaining limits |
|---|---|---|
| Full frontend regression | 2,403 passed | The subsequently added Task destination case and affected editor suites passed separately (42 cases). The reconciled frontend checklist contains 2,404 latest cases. |
| Backend unit regression | 1,172 passed; one blocked | Totals reconcile the full run with corrected fixture and affected-suite reruns. The private-storage symlink case remains blocked on Windows and needs Linux CI. |
| Native HTTP/SQL integration | 198 passed across eight suites | Accounts address (12), organization policy (17), Account privacy journey (1), CRM completion (21), conversion access (20), sales automation (34), Campaigns (74), SMS tracking (19). The coordinator detected two frontend Task files changing during execution; backend/shared/lock were unchanged. The frontend changes were verified separately. Do not report the coordinator itself as a clean pass. |
| Restricted-role Account regression | 12 passed | Reproduces the original insert failure and verifies guarded migration, creation, custom fields, history and tenant isolation without direct private-history access. |
| Guarded deployment/startup | Three passed | Populated disposable database, reviewed migration allowlist, unreviewed SQL rejection and backend runtime identity. No production deployment occurred. |
| Final browser journey | 23 passed | Workflow preview/activation and worker results; Task detail links, revision conflicts and timezone; Account retry/draft/persistence; loading and permissions. Task details fit light/dark 320/390/768/1440px; Assign actions pass hit-testing at 375/768/1440px. Screenshot review caught and corrected a toolbar stacking issue missed by the earlier bounds-only assertion. |
| Typechecks, schema and builds | Passed | Workspace/test TypeScript, Prisma validation and shared/backend/frontend builds. Final frontend build and browser coordinator share the exact executable identity below. |
| QA safety/harness | Passed with OS-specific skip | 16 environment/network checks passed; Linux temporary-directory case skipped on Windows. Discovery/deployment harness: 23 passed. Mailbox restart used three independent workers and one simulated send. |
| Dependency audit | Zero production advisories | Three development-only high entries remain in the unpatched development watcher chain. No blanket security certification is implied. |

Final executable-source SHA-256: `cbf077219f9491cebc4d163fd11e299bbd8a048dc427aa3541ee087348b7e9c9`.
Dependency-lock SHA-256: `d05b386cb279f61aa24785b5aa989ec2d2a944ed3ed897f27d0bf4ad0568c855`.
The hash identifies the tested implementation content on baseline `3f271da9`; it is not a deployed release identity. Documentation added afterward does not change executable identity.

Raw local evidence is retained outside committed source. The existing QA runner writes repeatable reports to ignored `data/outputs/system-audit/`; credentials, preview databases, sessions, logs and local paths are excluded from the commit.

Relevant repeatable commands:

```sh
npm run qa:typecheck
npm run qa:build
npm run test:integration:native -- --filter=organization-polish,contact-account-privacy,campaigns.integration,lead-conversion-access,crm-completion,sales-automation,accounts-full-address,sms-tracking
npm --prefix backend run test:accounts:trigger
npm run test:browser -- --filter=task-workflow-integrity
npm run test:qa-safety
npm run qa:docs
npm audit --omit=dev
```

These results establish only the named local scope. Live Coolify/browser access, exact deployed Account/SMS incident correlation, transport delivery and OAuth recovery remain blocked or unverified. The original inventory includes additional browser suites, handlers, physical-device, screen-reader, zoom and PWA scenarios that were not all rerun after implementation.

## Follow-up verification

The result table above records the first fix release. Further CRM draft/submission, Task initialization and mailbox shutdown corrections, together with the current verification commands and release boundaries, are described in [the follow-up notes](functional-verification-followup.md). Review the proposed revision's actual checks and final audit report separately from this historical evidence. Read-only production health/provider inspection was subsequently available; physical transport delivery and private production incident correlation remain unverified.
