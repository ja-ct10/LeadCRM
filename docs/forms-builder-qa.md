# Forms Builder QA evidence — 2026-10-11

Release gate: **QA BLOCKED**. The executed local checks passed. Real touch-device dragging and comparison against an approved pre-change mobile baseline remain unverified; this report does not declare production readiness.

Environment: local development UI and a disposable, in-memory PostgreSQL-compatible PGlite database. The fixture replayed the repository migrations and used the real backend routes, Prisma repositories, authentication, permissions, form publication and CRM persistence. No configured development, staging or production database was modified. No schema or migration changes were introduced.

## Implemented behavior

- The palette reads the canonical Leads catalog and displays the configured labels. Standard examples include First Name, Last Name, Email, Phone, Company Name, Product Interest, Lead Source and Full Address. Custom examples in the fixture include Age, Customer category, Notes, Preferred visit and Referral.
- Generic Text, Long Text, Number, Date, Dropdown and File Upload cards are removed. Input types remain internal to the renderer and existing saved definitions remain readable.
- Eligible Lead System and Lead Custom fields are classified separately. Canonical Custom Field definition IDs and existing readable technical aliases are preserved. Tenant, module, active and form-visibility checks run on the backend.
- LAYOUT offers Header, Paragraph and Separator line, following the user's latest request. All three render static content and never become submitted answers or CRM values. Legacy Heading definitions remain readable; Separator reuses the existing Divider type.
- Form name has the existing red required styling, an accessible required input and an inline empty-name message. Trimmed name validation remains authoritative at create, update and publish boundaries. Validation preserves the entered fields.
- Reorder arrows and their controls are removed. Desktop palette and canvas cards show drag handles. Drawer palette cards use tap-to-add and omit drag icons, drag semantics, grab cursors and drag hints. Pointer insertion, keyboard reordering, visible drag feedback and saved ordering were exercised.
- Lead Custom values use the existing canonical value repository in the submission transaction. Number answers become numeric CRM values; Text, Long Text, Date and Dropdown retain their configured semantics. Required settings and dropdown choices cannot be bypassed by editing requests.
- Existing header, tabs, canvas, Design panel, settings, draft/publish controls and responsive breakpoints are preserved. Existing unrelated Campaign changes in the working tree were not edited for this task.

## Actual execution counts

These counts describe executed test cases, not the number of checklist bullets.

| Test suite | Passed | Failed | Skipped | Blocked |
|---|---:|---:|---:|---:|
| Backend Forms validation | 18 | 0 | 0 | 0 |
| Backend Forms database/HTTP integration | 26 | 0 | 0 | 0 |
| Frontend Forms UI | 15 | 0 | 0 | 0 |
| Frontend Form Share UI | 5 | 0 | 0 | 0 |
| **Automated total** | **64** | **0** | **0** | **0** |

| Command/check | Actual result |
|---|---|
| `node backend/scripts/test-forms-disposable.mjs` | 44 tests passed; exit 0. All integration tests executed against the disposable database. |
| `npm --prefix frontend test -- src/features/tenant/marketing/forms/ui/forms.test.tsx src/features/tenant/marketing/forms/ui/form-share-panel.test.tsx` | 20 tests passed; exit 0. |
| `npm run build` | All 3 workspaces successful; exit 0. Prisma Client generated and Next production pages built. |
| `npm run lint` | All 3 workspace checks successful; exit 0. These repository scripts run TypeScript `tsc --noEmit`. |
| `npm --prefix backend run lint` after the final test assertions | TypeScript check successful; exit 0. |
| `git diff --check` | Passed. Git reported only line-ending conversion notices. |
| Browser submission data verifier | Passed; canonical CRM values, order, layout exclusion and duplicate count checked through the local API. |

The production build used the build-only HTTPS placeholder `https://leadcrm-build.example/api/v1`; this is not a deployment or live API check. The initial full-build attempts encountered a Prisma DLL lock held by the existing Campaign preview and the disposable QA API. After the user authorized stopping the Campaign preview, those processes were stopped and the build passed. An earlier lint attempt overlapped Next's generated-type cleanup; the final lint ran after the build and passed. Non-fatal build/test notices concerned the existing multiple-lockfile workspace-root detection and Vitest configuration loading.

## Checklist results

PASS below means the stated local evidence passed. BLOCKED identifies a mandatory verification gap. File Upload is not applicable to the current public Forms integration and was not counted as an executed upload test.

| Checklist | Status | Evidence and limits |
|---|---|---|
| QA-01 Form name | PASS | Red indicator screenshot; whitespace UI test retains fields; HTTP create/update/publish rejection; draft and publish workflows exercised. |
| QA-02 Remove arrows | PASS | No up/down controls in the canvas; handle/edit/delete controls retained; Standard, Custom and Layout cards exercised. |
| QA-03 Drag handles | BLOCKED | Native browser pointer drags from Standard/Custom palettes, keyboard canvas reorder, feedback and persistence passed. Actual touch hardware was unavailable. |
| QA-04 Standard Fields | PASS | Canonical Leads System catalog and configured labels; foreign-module catalogs excluded; protected/arbitrary native mappings rejected; submitted native values verified. |
| QA-05 Custom Fields | PASS | Canonical Leads Custom catalog, API refresh/rename, disabled/hidden/foreign identities, all five supported types, required and option validation, one value row per definition on repeat. File Upload remains unsupported. |
| QA-06 Layout | PASS | Header/Paragraph/Separator line offered per the latest request; content and order persist and render publicly; injected layout answers/mappings rejected; no layout CRM values created. |
| QA-07 Persistence | PASS | Standard, Custom and Layout fields, IDs, types, labels, settings, options and reversed order survive save/reload/publish in integration tests; browser order survives reopening and page reload. |
| QA-08 Publication/submission | PASS | Draft privacy, publication versions, required errors, success message, native/custom mappings, Product Interest, repeat inquiry matching, idempotency, transaction rollback and retained submissions executed. |
| QA-09 Mobile regression | BLOCKED | Builder and palette tested at all six requested widths with no page horizontal overflow; existing controls and sheet behavior exercised. No approved before/after visual baseline or real-device touch run was available. |
| QA-10 Security/permissions | PASS | HTTP view/create/edit/publish denials, cross-tenant read/edit/publish rejection, tenant/module Custom IDs, protected native mapping rejection, public answer whitelist, audit records, honeypot, payload bounds and anonymous 429 rate limiting executed. Upload integration is unavailable. |
| QA-11 Existing UI | PASS | Code diff and desktop/mobile browser inspection preserve existing structures and breakpoints. Existing controls, editing, deletion, settings, Share and thank-you behavior exercised by UI/integration tests. |
| QA-12 Tests/build | PASS | 64 executed tests, all-workspace TypeScript checks and full production build passed. Pointer/keyboard browser execution supplies drag evidence; no dedicated automated drag component test was claimed. |

Checklist-group counts: **10 Passed, 0 Failed, 0 Skipped, 2 Blocked**. No critical/high defect was observed in the executed checks. Unexecuted checks remain unverified.

## Original browser persistence and submission

The browser fixture initially contained the existing default form. A pointer drag added Age from CUSTOM FIELDS and Lead Source from STANDARD FIELDS. Keyboard dragging repositioned Age and Header. Header/Paragraph text was configured, a whitespace form name was rejected without losing the fields, then Save draft, Back/reopen, full page reload and Publish were exercised.

The intended and reloaded order matched exactly:

1. Lead Source
2. First Name
3. Age
4. Last Name
5. Company
6. Contact Number
7. Email Address
8. Product Interest
9. Welcome to our inquiry form — Header
10. Full Address
11. Please share your contact details and age. — Paragraph

The saved form had 11 fields, revision 2, published revision 2, and no duplicate field IDs. The public form presented the same order. Empty submission displayed required-field errors. A valid browser submission displayed the existing thank-you screen.

Read-only API verification found one Lead for the fixture email, with first name Browser, last name QA, company QA Company, address QA address and source Referral. Age was stored as the number **29** against canonical definition ID `6c32041c-6a9a-415d-8a0c-507f44dd3ed1`. Smart Lock retained its canonical Product identity. The submission excluded both layout blocks from its values. Automated repeat submissions also verified that Custom values update the same canonical rows without duplicate Leads or CustomFieldValue records.

## Responsive evidence

| Width | Builder | Palette | Actual observation |
|---:|---|---|---|
| 320 | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/builder-320.jpg`) | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/palette-320.jpg`) | No page horizontal overflow; 11 visible canvas handles; all three palette sections present. |
| 375 | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/builder-375.jpg`) | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/palette-375.jpg`) | Same checks passed. |
| 390 | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/builder-390.jpg`) | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/palette-390.jpg`) | Same checks passed. |
| 430 | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/builder-430.jpg`) | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/palette-430.jpg`) | Same checks passed. |
| 768 | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/builder-768.jpg`) | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/palette-768.jpg`) | Same checks passed. |
| 1024 | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/builder-1024.jpg`) | `Screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/palette-1024.jpg`) | Same checks passed. |

The existing mobile palette opens as a sheet, scrolls to its Custom section, closes with Escape and returns focus to the trigger. Viewport emulation proves the listed browser widths; it does not prove hardware touch behavior or pixel equivalence with an unavailable baseline.

## Required evidence index

| Requested evidence | Artifact/result |
|---|---|
| 1. Desktop builder | `1440px configuration reopened` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/configuration-reloaded.jpg`) |
| 2. Required name indicator | `Indicator` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/name-required.jpg`), `validation` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/name-validation.jpg`) |
| 3. Three palette sections | `Desktop palette and canvas` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/configuration-reloaded.jpg`), `additional Custom labels` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/desktop-builder.jpg`) |
| 4. Removed arrows/working handles | Screenshots show handle/edit/delete controls; actual pointer and keyboard actions described above. No drag video was captured. |
| 5. Drag persistence | `Expected/reloaded order and responsive measurements` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/browser-evidence.json`) |
| 6. Configuration reload | `Canonical fields and persisted revision` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/submission-data-evidence.json`) |
| 7. Published form | `Published screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/published-form.jpg`) |
| 8. Lead/Custom submission | `Thank-you screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/submission-success.jpg`), `verified CRM data` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/submission-data-evidence.json`) |
| 9. Mobile screenshots | All 12 builder/palette screenshots linked in the responsive table. |
| 10. Automated results | Executed commands/counts above; `machine-readable summary` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/automated-results.json`). |
| 11. Files modified | Forms-specific file list below. |
| 12. Limitations | Listed below; mandatory verification gaps keep the gate blocked. |
| 13. Coolify verification | **Not performed.** No staging/production deployment, migration or authenticated live acceptance was executed. I cannot confirm this. |

## Forms-specific files modified

Backend:

- `backend/src/api/routes/marketing.routes.ts`
- `backend/src/modules/marketing/forms/forms.controller.ts`
- `backend/src/modules/marketing/forms/forms.service.ts`
- `backend/src/modules/marketing/forms/forms.repository.ts`
- `backend/src/modules/marketing/forms/public-forms.service.ts`
- `backend/src/modules/marketing/forms/forms.validation.test.ts`
- `backend/src/modules/marketing/forms/forms.integration.test.ts`
- `backend/scripts/test-forms-disposable.mjs` — new disposable test runner
- `backend/scripts/qa-forms-local.mjs` — new disposable browser fixture
- `backend/scripts/verify-forms-browser-evidence.mjs` — new local submission verifier

Frontend/shared:

- `frontend/src/shared/services/forms.api.ts`
- `frontend/src/features/tenant/marketing/forms/services/forms.service.ts`
- `frontend/src/features/tenant/marketing/forms/ui/field-palette.tsx`
- `frontend/src/features/tenant/marketing/forms/ui/form-builder-page.tsx`
- `frontend/src/features/tenant/marketing/forms/ui/form-canvas.tsx`
- `frontend/src/features/tenant/marketing/forms/ui/form-input.tsx`
- `frontend/src/features/tenant/marketing/forms/ui/forms.test.tsx`
- `shared/src/contracts/forms.contract.ts`
- `shared/src/contracts/forms.contract.js` — generated shared runtime contract
- `docs/forms-builder-qa.md` — this report

Existing Campaign modifications were already present and are excluded from this list. No commit, push or deployment was performed.

## Remaining limits and release conditions

1. Execute real-device touch dragging/reordering and confirm saved ordering. Current evidence covers desktop pointer and keyboard plus mobile viewport emulation.
2. Compare the six mobile widths with an approved pre-change baseline. The relevant responsive classes/breakpoints were preserved, but baseline pixel equivalence was not executed.
3. Public File Upload is not supported by the existing Forms integration. Its generic palette card is removed and backend upload rejection remains enforced. No upload test is reported as passed.
4. Returning Contacts retain Lead Custom answers in the submission snapshot. Lead definitions are never substituted into Contact Custom values, and converted Leads are not revived. This preserves the existing returning-customer lifecycle.
5. Optional private/protected/reference native fields are outside the supported public mapping allowlist. Status, assignment and related-record identities cannot be edited through public answers.
6. No staging, production, Coolify, external notification delivery or additional browser-engine verification was performed. Those environments need their own acceptance run if included in the release scope.

Do not mark the full release gate QA PASSED until the mandatory blocked checks are executed and pass. Retest any defect discovered during those checks.

## Follow-up — Separator line and drawer cards

The latest user request supersedes the original two-block LAYOUT requirement: Separator line is now available alongside Header and Paragraph. It reuses the existing `divider` schema and static `<hr>` renderer; no backend/shared production contract change was needed.

The existing 1280px desktop/drawer breakpoint drives palette behavior. Below it, Layout, Standard and Custom cards are ordinary tap-to-add buttons with no drag icon, draggable description, drag listeners, grab cursor or drag tooltip text. Canvas reorder handles remain available. Desktop cards retain their handles and dragging.

The follow-up reran all **64** focused Forms cases: **64 Passed, 0 Failed, 0 Skipped, 0 Blocked**. Existing assertions were extended to cover Separator rendering, save/publish payloads, database reload order, public rendering, answer exclusion and injected-answer rejection, plus the drawer's tap-only semantics. The updated production build completed all three workspaces, and the final all-workspace lint/TypeScript checks passed. Initial sandbox test runs could not load suites due temporary-file rename permissions; the approved reruns executed successfully. One new test selector initially omitted the decorative separator icon text; the corrected selector passed on rerun.

Browser verification used a fresh disposable fixture, separate from the original 11-field fixture above. Tapping Separator line added one static line. Save draft and Back/reopen retained it, Publish succeeded, and the published form rendered one separator. The line has no respondent input. Drawer widths **320, 375, 390, 430, 768, 1024 and 1279px** each showed zero palette drag icons/descriptions/hints and no page horizontal overflow. At **1440px**, the desktop palette showed 16 handles, with its Separator card and the canvas reorder handle intact.

- `Drawer screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/separator-drawer-390.jpg`)
- `Desktop screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/separator-desktop.jpg`)
- `Published separator screenshot` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/separator-public.jpg`)
- `Follow-up browser measurements` (historical evidence path: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12ace-dd7f-79c0-8218-0be73c522c3e/forms-qa/separator-followup-evidence.json`)

Follow-up source changes are limited to `field-palette.tsx`, `form-builder-page.tsx`, their existing `forms.test.tsx` coverage, existing Forms backend validation/integration test assertions and this report. Deployment and real-device verification limits above still apply.

Historical link maintenance: 27 reference(s) pointed to absent local evidence or retired source. Their original labels and paths remain above as provenance; the referenced files are unavailable in this checkout. No current-release verification is inferred from those references.
