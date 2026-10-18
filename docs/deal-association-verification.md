# Deal association verification

Based on fetched `origin/main` at `f2bbf069`, implemented on
`codex/deal-primary-association` and integrated with `main` at `56fa9a63`.
No schema migration is required.

## Behavior and compatibility

- Create/Edit Deal uses the existing native select styling, Label, EntityCombobox,
  Button, field errors, toasts and drawer close guard. Changing type clears the
  selected record. Product Interests stays below Title with its existing prices,
  batch count and read-only historical value.
- New manual single and batch creation requires one active, visible, same-tenant
  Lead or Contact. Initial assignment comes from that record, validated against
  existing Deal-agent eligibility and assignment restrictions. Unassigned sources
  use the existing authorized fallback. No eligible owner produces a validation
  error. A valid source Account is reused without creating a company.
- Edit submits a targeted operation on existing ordered junctions. It removes
  only the explicitly replaced link and preserves current additional links,
  including links added since opening the form. Transaction retries reapply the
  original operation to the latest relationships. Ownership and Account are not
  implicitly changed. Authorized reassignment and additional relationship APIs
  remain available outside the form.
- A single existing association prefills the form. Missing or multiple legacy
  associations remain untouched during unrelated edits. With multiple links,
  choosing a record preserves the others; no new stored primary field is inferred.
- Existing automatic Product creation retains its contract. Committed legacy
  batch receipts replay without imposing new relationships on old Deals.
- The quotation wizard requires a linked Deal and uses the existing recipient
  relationship lookup for Leads and Contacts. The latest `main` quotation
  validation and Deal-bound Product behavior are preserved, along with its
  shared entity selector accessibility properties.
- Mock edits use the same shared junction patch. Mock creation inherits an
  eligible source agent, or an eligible current user when unassigned; otherwise
  it requests a corrected source assignment. Production uses server-side rotation.

## Verification

399 relevant backend tests and 341 frontend tests passed across the regression
sets and focused reruns. All 90 native-only cases skipped by the ordinary
regression invocation were executed successfully on disposable native databases.

| Check | Result |
| --- | --- |
| Related backend regression set | 228 passed; its 90 native-only cases run separately below |
| Lead conversion access | 20 passed on native PostgreSQL |
| CRM completion | 21 passed on native PostgreSQL |
| Lead editing, assignment and relationships | 12 passed on native PostgreSQL |
| Product normalization | 3 passed on native PostgreSQL |
| Sales automation | 34 passed on native PostgreSQL |
| Classification, conversion and revisions | 15 passed on native PostgreSQL |
| Workflow stage entry and Tasks | 14 passed on native PostgreSQL |
| Mailbox and atomic Product batches | 34 passed on disposable PostgreSQL-compatible SQL |
| Quotation API, PDFs and provider retry behavior | 18 passed on native PostgreSQL; provider calls mocked |
| Related frontend regressions and focused reruns | 341 passed |
| Responsive Create/Edit, switching and request payloads | Passed at 320, 375, 390, 430, 640, 768, 1024 and 1440px |
| Shared build, frontend production build and workspace typechecks | Passed |
| Backend TypeScript compilation and runtime asset packaging | Passed |

The association SQL suite includes ownership, Account reuse, source View grants,
assignment restrictions, tenant isolation, legacy replay, concurrent relationship
preservation during retry, batch values and Lead/Contact quotation lookup.
Manual-create fixtures were updated to supply their originating record. Outdated
status assertions now expect Inquiry for a new Contact and Warm after a customer
reply, matching the current classifier and the requested rules. Production
classification code was not changed.

Run the focused suites through the existing workspace test commands. After a
frontend production build, run
`node backend/scripts/preview-deal-association.mjs` for the isolated UI
matrix. It writes screenshots and results under the ignored
`data/outputs/system-audit/deal-association/` directory.

The normal Prisma generation command encountered a Windows DLL held by the
already running development backend. Its current generated client successfully
ran the SQL tests, typechecks and backend compilation; that existing service was
left running. No production database, provider delivery or deployment was used
for verification. The pre-existing untracked presentation documents were preserved.
