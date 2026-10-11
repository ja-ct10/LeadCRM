# Custom Fields inline editing — local implementation and evidence

This report covers the record Details follow-up to the Customize Fields implementation and records checks completed before the later publication request. No production migration or hosted deployment was performed. Production readiness is not asserted.

1. **Root cause.** `RecordCustomFieldDetails` filtered out missing/empty values and maintained a separate bulk editor. `CrmRecordView` mounted that component once for its toolbar and separately for each custom field. System fields used a different local `InlineEditRows` implementation.

2. **Files changed for this follow-up.**
   - `frontend/src/shared/components/crm/crm-record-view.tsx`
   - `frontend/src/shared/components/crm/record-custom-fields.tsx`
   - `frontend/src/shared/components/crm/inline-edit-rows.tsx` (extracted shared row)
   - `frontend/src/shared/components/crm/__tests__/record-custom-fields.test.tsx`
   - `frontend/src/shared/components/crm/__tests__/panel-migrations.test.tsx`
   - `backend/src/modules/crm/closing-requirements/custom-fields.integration.test.ts` (tests only)
   - `backend/scripts/verify-custom-fields-inline-browser.mjs` (new disposable browser harness)
   - `backend/scripts/verify-customize-fields-browser.mjs` (existing harness follows the new inline UI)
   - This report and the inline Details paragraph in `docs/custom-fields.md`.
   Earlier Customize Fields changes remain in the working tree. This follow-up introduces no schema, migration, backend persistence, alias contract, or closing-evidence implementation changes.

3. **Removed UI.** Removed `RecordCustomFieldEditor`, the record Details “Edit custom fields” button, its standalone form, and the Details-only bulk editing state. Create/Edit record forms retain `useRecordCustomFields`, `CustomFieldInput`, `CustomFieldGroup`, and `CustomFieldExtraGroups`.

4. **Rendering.** One authorized custom-field query per record feeds the same ordered catalog/sections as native fields. Current saved group IDs and field order determine placement. Canonical definition IDs determine custom React keys and writes. Ordinary fields exclude `isClosedWonField`; the section loop continues excluding `CLOSED_WON_GROUP_ID`. Saved disabled/retired values remain readable, with lifecycle labels. Empty retired/disabled fields are omitted. Show in Details hides the ordinary row; Show in Forms disabled leaves it read only.

5. **Blank fields.** Active eligible definitions render without a value row in the database. Missing, null, and empty values display “—”. Clicking initializes the appropriate empty control; opening or cancelling creates no value write. Zero displays as zero. Newly required fields do not block reading an existing record.

6. **Shared inline interaction.** Extracted the existing native `InlineEditRows` into `inline-edit-rows.tsx`; native rows still use their existing validators and API handlers. Custom rows supply their typed editor and validator to that component. They share the right-aligned clickable value, hover/focus pencil, row layout, Save/Cancel controls, spinner, and error presentation. Editor identity uses the stable key, so a label refresh does not discard the draft.

7. **Editors.** `CustomFieldControl` serves record forms and inline Details. Text uses a single-line input (1,000 characters); Long Text uses a textarea (10,000 characters) and displays interior newlines; Number uses the existing decimal control and finite-number validation; Date uses the existing date input and `YYYY-MM-DD`; Dropdown uses only its configured choices, with a disabled historical choice retained for display; File Upload uses the existing authorized record upload endpoint and metadata. File values never display raw IDs. The ordinary row offers the authorized “Open file” link. Cancel/clear do not delete stored attachments.

8. **Validation and persistence.** Frontend `closingValueError` validates the intended field before Save. Each successful write is `PUT /crm/{module}/{recordId}` with exactly one canonical `customFieldValues` key. Blank optional values become null; omission leaves other values untouched. Existing backend transaction, tenant, module, editability, record/file association, signature, size, and required-field validation remain authoritative. The existing backend validates all currently required editable fields on a record mutation; a newly required missing field may therefore prevent a different field save until supplied. This policy was preserved. Failed saves keep the input and saved value; retry can succeed without reopening the row.

9. **Caches and drafts.** Successful writes update the one authorized record custom-state value and use existing API invalidation to refresh catalog/layout/record views. No polling was added. Row editors and record/tab/scroll containers stay mounted across ordinary cache refreshes. Transient failures retain loaded values and drafts and expose “Retry custom fields”; saving is paused while that read error is unresolved. Authoritative 401/403/404 reads retain the existing cache eviction policy. A denied ordinary write clears the restricted custom state and rechecks access. Record-edit revocation dismisses the draft.

10. **Permissions.** Four-module authenticated HTTP/SQL checks cover record editors without configuration permission, configuration editors without record edit permission, and partial updates. Backend tests also cover tenant/module isolation and unauthorized file claims. Component checks cover read-only fields, hidden-in-forms fields, disabled/retired history, and denial cleanup.

11. **Module checks.** Local browser and HTTP/SQL evidence cover Leads, Contacts, Accounts, and ordinary Deals. Browser cases use real API routes and a migrated disposable SQL database. Each module exercises definition-only blank rows, assigned groups, all six controls, Cancel, persistence/reload, zero, clearing to null, unrelated-value retention, and attachment retention. Component suites exercise required/invalid values, historical dropdown choices, label refresh, drafts, and native inline behavior.

12. **Browser evidence.** Artifacts are outside the repository in `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12911-3e05-7a62-af7d-3c8ea4abe64f/custom-fields-inline`. The completed browser run passed 40 checks with zero page errors. It saved per-module full-page and actual list/pipeline drawer screenshots, inline controls at 320/375/390/430/768/1024/1440/1920 pixels, dark-mode views, and `report.json`. Representative 320px drawer, 390px dark-mode page, 1440px full page, and closing-section screenshots were also inspected visually.

13. **Closed Won protection.** `DealClosingRequirements` and Deal stage/closing implementation source remain untouched by this follow-up. Existing seven component regressions and the authenticated SQL closing regression verify progress/validation, specialized evidence controls, Qualified-stage gating, automatic closing, locks, and retained snapshots. Browser comparison captures the section before and after ordinary Deal edits, compares its text, and exercises the existing evidence Edit/PATCH/progress interaction.

14. **Checks/build.** Final executed commands and counts are recorded below. Sandbox attempts encountering access-denied/temporary-cache EPERM/local socket restrictions were rerun with approved escalation against disposable/local resources. No test attempt that failed before loading tests is counted as passing.

15. **Coolify.** No deployment was requested or performed. I cannot confirm this change on the deployed frontend/backend or confirm production workflow acceptance.

16. **Limits.** External bucket responses are simulated in the browser/HTTP tests; the real upload validation, authenticated route, record association, database writes, and metadata are exercised. Live Supabase storage was not exercised. Cross-device/cross-tab updates are limited to the repository's existing refresh infrastructure; no new push transport was introduced. The build environment uses the configured production API URL without connecting to production records. Broader unrelated suites were not rerun for this UI follow-up; the prior Customize Fields report records its separate baseline issue.

Final executed results:

| Check | Result |
|---|---|
| Frontend Vitest run, eight targeted test files | 154 passed, zero failed or pending; JSON evidence in `frontend-tests.json` |
| `node backend/scripts/test-custom-fields.mjs` | 19 integration tests passed; disposable migrated database, alias maintenance applied twice without changing historical identities |
| `node backend/scripts/verify-custom-fields-inline-browser.mjs` | 40 browser checks passed; zero page errors; all four modules, actual drawers/full pages, eight widths, light/dark, keyboard/touch, uploads, refresh failures, native inline save, and specialized closing evidence |
| `npm run lint` | Three workspaces successful; includes TypeScript checks |
| `npm run build` with `API_URL=https://api.lead-crm.tech/api/v1` | Three workspaces successful; backend/Prisma generation and Next.js production compilation/type checks, 180 generated pages; 1m1.744s |
| `git diff --check` | Passed |
| `node --check` on both browser harness scripts | Passed |

The targeted frontend files were `page-cache.test.ts`, `cached-page.integration.test.tsx`, `deal-closing-requirements.test.tsx`, `inline-deal-form.test.tsx`, `panel-migrations.test.tsx`, `record-custom-fields.test.tsx`, `contact-save.test.tsx`, and `closing-fields-settings.test.tsx`. The final run used the completed source, including backend-error presentation and unchanged native row sizing. The build retained the existing Next.js multiple-lockfile/workspace-root warning; no unrelated build configuration was changed.

Browser fixture/selector failures during harness development were corrected before the successful final run. Only the final complete run is counted above. No production database, provider send, commit, push, or deployment was used for these checks.

The user subsequently requested publication to both Git remotes. The combined-source publication checks, upstream revision and later localhost database limitation are recorded in sections 21-22 of [the Customize Fields report](customize-fields-2026-10-11.md).
