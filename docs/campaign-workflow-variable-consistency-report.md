# Campaign and Workflow variable consistency report

Date: 2026-10-11. Repository: LeadCRM, branch `main`.

The implementation is complete locally. Campaign insertion uses the authoritative field catalog, and corrected Workflow tokens resolve through the existing backend execution path. Local builds, type checks, integration tests and browser checks passed as detailed below. The broad frontend regression run also exposed three pre-existing Workflow condition accessibility assertions; those failures were reproduced using the unchanged HEAD component and remain outside this variable-only change. This report does not declare production readiness or real provider delivery verified.

The source audit started from `c297b2993ce1ff6216a69ed9cb4bd45024cc7517`. At that audit, `upstream/main` and `origin/main` both resolved to that SHA. Changes remain in the local working tree; no commit, push, production database change or deployment was performed.

## 1. Root causes

The Campaign picker prepended the static snake_case email alias list and grouped catalog entries by their existing field groups. Its catalog request only loaded the selected Lead or Contact source. Quick Fields independently used the static legacy token list. This produced the old “Existing aliases” category and inconsistent new insertion keys, even though backend personalization already understood native technical keys and readable custom aliases.

Workflow shortcuts, validation and rendering shared a legacy-only token list. Merely changing button text would have left canonical tokens rejected or unresolved at runtime. SMS sender personalization also hardcoded an organization name, while its public settings endpoint only exposed organization email. Contact canonical `company` rendering incorrectly preferred a related Account name over the Contact's own configured scalar field.

## 2. Final Insert Variable structure

The builder and template editor share the existing picker with exactly these three category headings, including during search:

1. Standard Fields.
2. Custom Fields.
3. Sender.

There are no module category headings or Existing aliases category. Module origins appear only as secondary entry metadata. Existing dimensions, scrolling, colors and compact controls are retained.

Readability follow-up: the user confirmed a visibility-only fix for Account/Deal entries. Disabled rows now keep full-contrast labels, tokens and module metadata instead of 50% opacity. Tokens/metadata use 11 px text, repeated audience warnings are shortened, and the complete binding explanation remains in the tooltip. Search now advertises module matching. The existing Campaign picker/builder/template tests passed 42/42, frontend type checks passed, and the local browser confirmed Account Name and Deal Value rows have opacity 1 while remaining disabled. No backend availability rule changed.

Audience UI follow-up: the audience panel hides the numeric pagination range and places the existing Per page selector on the left. This is an opt-in setting on shared PaginationControls. Add Condition uses the existing primary Button. Audience Name and Field have red required markers; Value has one for operators that require a value. Insert Variable reuses ModuleSearchInput with full width inside the popup. Existing shared component defaults remain intact. All 47 audience/picker/builder/template tests and frontend type checks passed after these changes. Local browser screenshots confirmed the required markers, blue button and left-aligned selector without the old range. No audience was saved during verification.

Existing-fields follow-up: the four Age entries in the navigation preview came from its disposable fixture, rather than hardcoded picker choices. The saved configuration contained exactly those four untouched sample definitions. They were retired through the existing tenant-scoped API, retaining historical values, and their reference was removed from the unchanged fixture Email draft. The preview setup no longer seeds sample custom definitions. Customize Fields and the variable catalog then both returned zero custom fields, and browser verification showed no custom entries. Added regressions verify empty/deleted definitions are omitted and historical values remain stored. The latest checks passed 49/49 Campaign UI tests, 63/63 Campaign integration tests and all three workspace type checks. The application continues to read only actual non-deleted tenant definitions; no production configuration was changed.

## 3. Standard Fields aggregation

The new read-only catalog endpoint aggregates `getCrmFieldCatalog` for Leads, Contacts, Accounts and Deals. It applies each module's tenant field-layout preference, including administrator-configured labels. Entries classified `System` appear in Standard Fields, including existing system definitions managed through Customize Fields.

The picker displays the catalog's exact `technicalKey`. New insertion uses `firstName`, `lastName`, `phone`, Lead `companyName` and Contact `company`, without deriving snake_case aliases from labels. The available system list is generated from the shared catalog rather than a parallel Campaign list.

## 4. Custom Fields aggregation

All four modules' tenant-scoped definitions feed the same catalog. Entries classified `Custom` appear in Custom Fields with their existing readable immutable alias, for example `customFieldValues.age`.

Each choice retains its module, canonical definition ID, canonical technical key and availability metadata. Renaming Age to Customer Age changes the displayed label while leaving the alias and stored identity unchanged. No `CustomFieldValue.fieldId`, saved template or historical definition identity is rewritten.

## 5. Duplicate keys

Equivalent native entries are combined only when kind, exact key, label, type and reference semantics agree. All origins are retained. Differently labeled entries and different keys such as `companyName` and `company` stay distinguishable.

Custom choices retain separate `module:definitionId` identities even when their displayed aliases match. Availability is determined by the effective recipient source, and backend custom values are explicitly queried by tenant and module. A Lead's Age 25 and a Contact's Age 42 resolved independently in the integration test using the same readable alias.

## 6. Sender technical keys

Sender contains exactly Sender Name (`{{sender_name}}`) and Sender Email (`{{sender_email}}`). Existing token names remain unchanged. Configuration property names such as `senderName` do not become template tokens.

## 7. Actual sender sources

| Channel | Sender Name value | Sender Email value |
| --- | --- | --- |
| Email | Existing `getBrevoSenderIdentity()` using `BREVO_FROM_NAME` and its existing configured fallback | `BREVO_FROM_EMAIL` |
| SMS | Current tenant organization `name`, trimmed | Current tenant organization `email`, validated |

The public settings endpoints expose only identity values. No provider key is returned. Email remains tied to the provider identity rather than the organization database email or signed-in employee. SMS tokens represent organization contact identity; they do not alter the TextBee originating device or gateway contract. The existing fixed legal footer remains intact.

Missing sender values display an unavailable state. The Campaign builder disables the corresponding shortcut and blocks send/schedule when its token is used. Backend checks enforce this independently. SMS messages without an organization email token can retain the existing sending behavior when that contact value is absent. Existing provider configuration checks remain enforced.

## 8. Campaign insertion and refresh

Quick Fields now derive their existing seven semantic shortcuts from the same choices as Insert Variable. They use canonical recipient keys and retain the two sender shortcuts. Unsupported fields are disabled.

The builder preserves active Subject/Body selection insertion, selection replacement, focus restoration, closing behavior and native draggable Quick Fields. The template editor now inserts into the active Subject or Content selection instead of always appending to Content. Placeholder examples use current canonical keys.

Search matches label, technical key, classification and module metadata across the unified catalog. It does not require a module filter to find metadata from all four modules.

Catalog and public sender settings use the existing tenant/user-scoped page cache. Customize Fields invalidation refreshes catalog data; organization-setting mutations now invalidate settings as well. Builder focus and picker reopening also revalidate current values. There is no new polling interval and no hard browser refresh requirement. Draft text is retained when labels/configuration change.

## 9. Backend personalization

`campaignApprovedVariableKeys` is shared by frontend preflight and backend validation. It admits eligible technical keys, saved canonical custom-ID keys, the canonical sender tokens and supported legacy aliases for eligible corresponding fields. Hidden, disabled, protected or unsupported fields cannot bypass this policy through legacy aliases.

Send Now, scheduling and scheduled dispatch validate against the effective Lead/Contact source. Recipient personalization reuses the existing catalog projection, scalar/date/product/reference handling and rendering/sanitization. Canonical Contact `company` now resolves to the Contact scalar; legacy `company_name` retains its historical related-Account fallback.

The sender identity is resolved at submission preparation and persisted in the existing recipient personalization snapshot. Sender configuration changes made after scheduling were verified to affect the later Email/SMS dispatch, while previously sent recipient snapshots remained unchanged.

## 10. Account and Deal availability

Account and Deal metadata appears in the required categories. There is no supported general relationship-binding contract for their fields in the current Campaign recipient model, so those origins are disabled with an explanation. Their mere presence or an identical token does not authorize relationship traversal.

The existing readable Lead/Contact `accountId` reference projection remains available under its existing contract. This does not make arbitrary Account fields or Deal selection available. No direct Account/Deal audience source or relationship resolver was introduced. An unsupported Deal Value token was rejected at both schedule and send boundaries without submitting a message or consuming the draft.

## 11. Preview and delivery-path results

Frontend preview uses explicit recipient samples and current configured channel identity. Email/SMS template previews no longer fabricate a sender email. The builder continues to label preview values as samples.

The actual backend rendering/submission path produced `Hi Josh, your age is 25. Legacy Josh.` for the Lead and the corresponding Jane/Age 42 content through scheduled Contact dispatch. Configured sender values appeared in Email HTML and SMS content. Existing Email escaping, HTML sanitization, links and SMS footer behavior passed focused regressions.

These checks used mocked provider transports, with real disposable SQL persistence and applicable authenticated API paths. They prove backend content and submission behavior locally; they do not prove Brevo/TextBee delivery, recipient inbox/handset receipt or production provider configuration. I cannot confirm this.

## 12. Workflow shortcut labels

The existing four semantic shortcuts use catalog labels and entity-specific keys:

| Existing shortcut | Lead token | Contact token |
| --- | --- | --- |
| First Name | `{{firstName}}` | `{{firstName}}` |
| Last Name | `{{lastName}}` | `{{lastName}}` |
| Email | `{{email}}` | `{{email}}` |
| Company Name | `{{companyName}}` | `{{company}}` |

Configured system label overrides are respected. No custom-field shortcuts, new Account/Deal semantic shortcuts, picker or categories were added. Fields absent from an entity's existing four-field mapping do not acquire manufactured support. Existing compact shortcut styling and supported text-field placement are retained.

## 13. Workflow runtime resolution

Frontend and backend validation now accept entity-specific canonical tokens alongside saved legacy keys. The existing action renderer reads the matching record context for canonical tokens while retaining its legacy mapping, HTML escaping and plain-text control handling.

Real authenticated Lead/Contact creation triggered workflows and persisted Task titles containing the actual first name and entity-specific company value. Legacy Task description tokens also resolved. Existing trigger, condition, sequencing, assignment, task, stage, activation, history and authorization implementations were retained.

## 14. Legacy compatibility

Saved Campaign `first_name`, `last_name`, `company_name` and `contact_number` references remain compatible where the corresponding field remains eligible. `status` uses its existing catalog key. Saved canonical custom-ID keys remain accepted and mapped to the same definition value.

Workflow `first_name`, `last_name`, `email` and `company` remain accepted and rendered by the existing legacy mapping. No historical Campaign, Template, Schedule or Workflow configuration rewrite was introduced. Newly inserted shortcuts use current keys.

## 15. Files changed

Shared contracts and generated counterparts:

- `shared/src/contracts/campaign-fields.ts`
- `shared/src/contracts/campaign-fields.js`
- `shared/src/contracts/campaign.contract.ts`
- `shared/src/contracts/workflow-catalog.ts`
- `shared/src/contracts/workflow-catalog.js`

Backend:

- `backend/src/api/routes/marketing.routes.ts`
- `backend/src/modules/marketing/campaigns/audiences.controller.ts`
- `backend/src/modules/marketing/campaigns/audiences.service.ts`
- `backend/src/modules/marketing/campaigns/campaigns.controller.ts`
- `backend/src/modules/marketing/campaigns/campaigns.service.ts`
- `backend/src/shared/services/sms.service.ts`
- `backend/src/modules/automation/actions/action-validation.ts`
- `backend/src/modules/automation/actions/action-dispatcher.ts`

Frontend:

- `frontend/src/shared/services/campaigns.api.ts`
- `frontend/src/shared/cache/invalidate-api-page-cache.ts`
- `frontend/src/shared/components/crm/pagination-controls.tsx`
- `frontend/src/shared/components/crm/module-search-input.tsx`
- `frontend/src/features/tenant/marketing/campaigns/ui/audience-panel.tsx`
- `frontend/src/features/tenant/marketing/campaigns/ui/campaign-variable-picker.tsx`
- `frontend/src/features/tenant/marketing/campaigns/ui/campaign-builder.tsx`
- `frontend/src/features/tenant/marketing/campaigns/ui/campaigns-page.tsx`
- `frontend/src/features/tenant/automation/workflows/ui/workflow-fields.tsx`
- `frontend/src/features/tenant/automation/workflows/services/workflow-editor.ts`

Tests and repeatable browser verification:

- `backend/src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts`
- `backend/src/modules/automation/workflows/__tests__/workflow.integration.test.ts`
- `backend/src/shared/services/__tests__/sms.service.test.ts`
- `frontend/src/features/tenant/marketing/campaigns/ui/__tests__/campaign-builder.test.tsx`
- `frontend/src/features/tenant/marketing/campaigns/ui/__tests__/campaign-variable-picker.test.tsx` (new)
- `frontend/src/features/tenant/marketing/campaigns/ui/__tests__/campaigns-page.test.tsx`
- `frontend/src/features/tenant/automation/workflows/ui/workflow-message-variables.test.tsx` (new)
- `frontend/src/shared/cache/__tests__/api-invalidation.test.ts`
- `backend/scripts/verify-campaign-variables-browser.mjs` (new)

Documentation: `docs/API.md` and this report. Screenshots and browser logs are outside the repository.

## 16. API and database changes

New `GET /api/v1/marketing/campaigns/variable-fields` returns `{ success: true, data: CrmFieldCatalogEntry[] }`, protected by the existing ready-workspace middleware and `campaigns.view`. The endpoint checks matching tenant context and reads only scoped definitions/layouts.

Existing SMS settings adds `organizationName` and retains `organizationEmail`, represented by the new shared `CampaignSmsSettings` type. Email settings continues to return the existing Brevo public identity contract. See [API reference](API.md#marketing-endpoints).

There is no Prisma schema change, new database field, migration or production data mutation. Custom-field IDs, aliases, versions, values and historical snapshots stay in their existing structures.

## 17. Automated checks actually executed

| Check | Result | Evidence scope |
| --- | --- | --- |
| Campaign SQL/API integration | 63/63 passed | Send Now, scheduled dispatch, custom aliases/IDs, tenant/RBAC, rendering, configuration changes, hidden/unsupported tokens, lifecycle regressions, empty/deleted definitions and preserved historical values |
| Workflow SQL/API integration | 55/55 passed | Canonical/legacy persisted tasks, existing execution/action/permission regressions |
| Focused backend unit suite | 56/56 passed | Campaign content, Email/SMS services, action validation, Workflow catalog/validation |
| Custom-field migration/alias suite | 19/19 passed, accompanying SQL checks passed | Disposable migration replay, tenant/module constraints, preserved IDs/values/history, idempotent alias maintenance applied twice |
| Broad applicable frontend suite | 174 passed, 3 failed out of 177 across 15 files | Campaign UI/cache and Workflow regression tests; failures identified below |
| Additional template coverage | 11/11 passed in the page test file | Includes three added acceptance cases for insertion/focus and Email/SMS previews |
| Baseline failure reproduction | Same 3 assertions failed with HEAD Workflow component | Existing condition `aria-required` expectations, unrelated to variable insertion |
| Final `npm run lint` | All 3 workspaces passed | Repository lint commands run TypeScript `tsc --noEmit` |
| `git diff --check` | Passed | No whitespace errors |

Executed integration commands:

```powershell
node backend/scripts/test-campaign-groups.mjs src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts
node backend/scripts/test-workflow-polish.mjs src/modules/automation/workflows/__tests__/workflow.integration.test.ts
node backend/scripts/test-custom-fields.mjs
```

Focused backend unit command:

```powershell
npm --prefix backend run test -- src/modules/marketing/campaigns/__tests__/campaign-content.test.ts src/shared/services/__tests__/email.service.test.ts src/shared/services/__tests__/sms.service.test.ts src/modules/automation/actions/__tests__/action-validation.test.ts src/modules/automation/workflows/__tests__/workflow-catalog.test.ts src/modules/automation/workflows/__tests__/workflow-validation.test.ts
```

Broad frontend command and subsequent template check:

```powershell
npm --prefix frontend run test -- src/features/tenant/marketing/campaigns/ui/__tests__/campaign-builder.test.tsx src/features/tenant/marketing/campaigns/ui/__tests__/campaign-variable-picker.test.tsx src/features/tenant/marketing/campaigns/ui/__tests__/campaigns-page.test.tsx src/features/tenant/automation/workflows src/shared/cache/__tests__/api-invalidation.test.ts --maxWorkers=2 --testTimeout=15000
npm --prefix frontend run test -- src/features/tenant/marketing/campaigns/ui/__tests__/campaigns-page.test.tsx --maxWorkers=1 --testTimeout=15000
```

The broad run preceded the three additional template cases. The subsequent 11-case page run includes its original eight cases and those three additions; these are not eleven extra unique tests. Final type checks passed after all test edits.

The three broad-suite failures are the parameterized `removes only condition...` cases in `workflow-polish.test.tsx`, whose assertion expects `aria-required="true"` on Condition 1 field while the component returns no attribute. An isolated temporary test using the original HEAD `workflow-fields.tsx` reproduced the same three failures. Temporary baseline files were removed. Condition controls/validation were left unchanged as required by the scope. No full-suite-green claim is made.

Sandbox cache/socket permission failures were retried with approved focused escalation. An initial high-concurrency frontend run had additional timeouts; limiting workers to two removed those timeouts. A test fixture query typing issue was corrected and final type checks passed.

## 18. Responsive verification

The repeatable browser script used headless Chrome, the compiled production frontend, an authenticated local backend and a fresh disposable SQL database with existing migrations. Mock auth/data modes were disabled. Browser API traffic was routed to the local backend. No Campaign was submitted to a real provider.

All 19 browser checks passed with zero page errors and zero transport errors:

- Campaign picker/layout at 320, 375, 390, 768, 1024 and 1440 px, with the exact three headings, retained origin identities, disabled unsupported fields and no horizontal page/picker overflow.
- Canonical Quick Fields insertion into Subject; readable alias selection replacement and dropdown closure.
- Configured Email sender preview, label refresh on picker reopening, and updated SMS organization preview with preserved footer.
- Existing Lead/Contact Workflow shortcuts and layout at 320, 390, 768 and 1440 px; canonical entity keys and retained legacy description text.

Desktop and mobile screenshots were visually inspected for both modules. Evidence directory:

`C:\Users\Julie Ann Tiron\.codex\visualizations\2026\10\11\01a129a0-5887-7450-851b-046725b221bc\campaign-variables`

It contains `report.json`, `campaign-picker-{width}.png`, `workflow-{entity}-{width}.png` and the local frontend log. The script accepts `CAMPAIGN_VARIABLES_OUTPUT` and `PLAYWRIGHT_MODULE` environment paths for repeatable runs.

## 19. Production build

Shared, backend and frontend production builds all passed. Next.js generated 180 pages. The build used a process-only valid HTTPS placeholder for `API_URL` because local HTTP configuration correctly fails production URL validation:

```powershell
$env:API_URL='https://build-verification.example.invalid/api/v1'
npm run build -- --env-mode=loose
```

No environment file or production configuration was edited. The build included the initial variable implementation. Additional acceptance tests, documentation and the subsequent picker readability and audience UI follow-ups were verified afterward with type checks and applicable UI tests; a production build was not rerun for those UI follow-ups. The existing Next.js multiple-lockfile warning remains. Build success does not prove deployment or real provider delivery.

## 20. Coolify deployment status

No Coolify deployment, Git publication or production migration was performed for this change. Production service revision and live behavior were not verified. I cannot confirm this.

## 21. Remaining limitations

- The broader frontend suite has the three reproduced pre-existing Workflow condition accessibility failures described above. Applicable variable acceptance tests passed, but the complete selected regression run is not green.
- Actual Brevo/TextBee delivery, real recipient receipt, live sender configuration, production multi-user acceptance and deployment remain unverified. I cannot confirm production readiness.
- General Account/Deal personalization remains unavailable without an existing explicit authorized relationship-binding contract. No such new binding was added.
- Recipient preview remains a labeled sample; authoritative recipient values are resolved at the backend submission boundary.
- The changes are local and uncommitted. Existing production data, custom-field identities and delivery history were not changed.
