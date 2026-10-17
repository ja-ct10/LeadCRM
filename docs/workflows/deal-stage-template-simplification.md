# Deal stage and workflow template simplification

## Changes

Change stage in the shared Deal card menu now shows only open stages from the
Deal's current active pipeline. The pipeline is displayed as context rather than
an editable dropdown. The action always uses the existing stage endpoint, so it
cannot transfer the Deal to another pipeline. Won and Lost retain their governed
outcome actions and closing requirements.

When a frontend record has no pipeline reference, a unique active pipeline named
Sales Pipeline supplies its choices. An unavailable assigned pipeline never
silently falls back. Missing/ambiguous defaults or inconsistent current stages
block saving with the existing unavailable-state guidance. Persisted Deals still
require pipeline/stage references; no database constraints are relaxed. Mock
stage changes use the same fallback policy.

The existing stage mutation updates shared Deal state and invalidates Deals,
Activity and related people/Account views. Backend stage writes retain atomic
stage history, activity, audit and workflow queueing. No parallel stage writer
or new pipeline transfer behavior was introduced.

Contacts and Leads retain their simple labels. Their association helper text no
longer includes `(optional)`; validation and ID-based multi-selection are unchanged.

## Curated templates

The chooser contains 16 scenarios, independent of pipeline/stage count:

| Record | Templates |
| --- | --- |
| Deals | New Deal Created; Deal Stage Changed; Deal Entered a Specific Stage; Automatic Deal Stage Update; Move New Deal Stage; Deal Marked as Won; Deal Marked as Lost; Deal Assigned |
| Leads | New Lead Follow-up; Hot Lead Urgent Response; New Lead Email Welcome; Hot Lead → Move Related Deal |
| Contacts | Contact Onboarding Handoff; Contact Welcome Email Template; Hot Contact → Move Related Deal |
| Accounts | Account Field Maintenance |

Automatic Deal Stage Update starts with a real priority change to High, an exact
source pipeline/stage condition and a different open target stage. Linked setup
keeps conditions and the destination consistent. Users can review/customize the
conditions before activation. Move New Deal Stage handles creation instead of
ordinary updates. Related Lead/Contact moves retain explicit matching rules.

Stage-change and specific-stage task templates are alternatives for the same
business task. Independent matching workflows can each execute, so preview
guidance explains this overlap. Existing event identities, same-stage no-ops,
current-entry checks and workflow-chain guards remain in place. Templates are
inactive drafts until configured and activated through existing controls.

The chooser hides repetitive follow-ups and per-stage variants. The append-only
recipe registry, numeric indexes, stable starter IDs and earlier configured-stage
URLs remain supported. No saved workflow definitions, execution histories or
user records are rewritten or deleted.

Inactivity/wait timers and Task triggers are not implemented by the existing
engine and are not offered. Assignment/task notifications continue through the
existing notification system. Messaging remains available in the builder.

## Conversion consistency

The lifecycle regression checks exposed a pre-existing raw-transaction conversion
issue: shared Account creation could commit independently before workflow
queueing failed. Conversion Account creation now binds to the supplied sales
transaction, preserving the existing validation/audit/permission logic and
rolling back with the Lead, Contact, associations and queued events.

## Verification

Verified locally on 2026-10-17:

| Check | Result |
| --- | --- |
| Deal controls/forms and template catalog/setup/chooser | 114 component/service tests passed |
| Workflow builder and legacy template URLs | 118 component tests passed |
| Legacy stage-template validation rerun | 6 tests passed; included in the 114 above |
| Deal pipeline/stage persistence and rejection cases | 16 isolated database tests passed |
| All nine Workflow database suites | 216 passed, zero failures/skips, native PostgreSQL 18.4 cleanup complete |
| Production Deal actions browser | 52 checks passed, including Sales/Renewals, board/related views, creation, permissions, closure and responsive controls |
| Template → configured draft → activation → real worker → Task browser | 23 checks passed, including repeated clicks/re-entry, dirty draft preservation and restricted-role access |
| Responsive workflow controls and curated chooser | 22 journeys passed across Light/Dark and 320/375/768/1440px; no page/server errors; cleanup complete |
| Frontend TypeScript and backend production/test TypeScript | Passed |
| Frontend production build | Passed |
| Backend production compilation and launcher copy | Passed using the existing matching Prisma client |

The database suites configure and execute the complete 35-recipe registry,
including hidden compatibility recipes. They also verify the new automatic-stage
template through real Deal updates, source pipeline/stage guards, repeat handling
and conversion rollback. The browser coordinator passed with unchanged source
during its run; its Mailbox worker restart check also passed. Mobile stage
dialog screenshots were inspected at 320 × 500.

`npm --prefix backend run build` could not regenerate Prisma because a separate
running disposable preview holds Windows' `query_engine-windows.dll.node` file.
The current generated client matches all 79 schema definitions after formatting
normalization; schema files were not changed. Backend `tsc` and launcher copy
completed separately. Stop that preview before the next Prisma regeneration.

All acceptance uses disposable fixtures and blocked/mocked external providers.
No configured application database, purchases, payments, real email or SMS sends,
deployment or production data migration was performed. Inactivity timers and Task triggers
remain engine capabilities that would require separate implementation.

Reproduce with the focused frontend tests in the changed test files,
`npm --prefix backend run test:workflows:integration`, the isolated
`deal-pipeline.integration.test.ts` suite, and
`node scripts/qa-local.mjs browser --filter=verify-deal-actions-browser,verify-task-workflow-integrity-browser`.
The broader responsive workflow harness is
`npm --prefix backend run test:workflow-policy:browser`.
