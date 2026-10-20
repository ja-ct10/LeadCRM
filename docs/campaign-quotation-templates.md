# Campaign quotation templates

Campaigns exposes All Campaigns, Email Templates and SMS Templates. The Quotation
Templates tab and its exclusive list/editor/wizard UI have been removed. Existing
quotation records, backend APIs and PDF utilities remain available; CRM Files and
Inbox continue to use the unchanged shared attachment preview. UI implementation
and verification details below describe the former quotation interface.

## Implementation and reuse

Changed areas: Campaigns page plus the new quotation UI/API client and focused
tests; shared quotation/Campaign contracts and generated JavaScript companions;
template validation/search/seeding; Campaign quotation controller/service/PDF
renderer; internal Gmail send/receipt/MIME support; optional Product-selector
search and currency formatting; backend dependencies, font assets and Docker
asset copying. Browser/database verification scripts and this API reference
document the feature. Existing Contact changes are retained separately.

- Templates use existing `Template` rows with `type: Quotation`. `content` holds
  validated JSON containing title, header, introduction, fixed table layout and
  footer. Recipient/Product selections belong to the session-local wizard.
- The UI reuses ModuleTabs, Campaign card styling, ModuleTableToolbar,
  ModuleFilterRail, LeadsPagination, SideSheet and its draft-close guard, Button,
  Badge, TableIconButton, EntityCombobox, ProductInterestSelect, DatePicker and
  the Campaign variable picker/cursor utility. Product search and quotation
  variable grouping are opt-in extensions to existing controls.
- New UI is limited to the Campaign quotation list/editor, four-step wizard and
  variable-field wrapper. No compatible quotation editor or wizard existed.
- No quotation database migration, lifecycle table or separate permission system
  is introduced. The independent Contact `companyName` migration remains a
  prerequisite; see [the Contact rename](contact-company-name.md).

## Variables and data

The shared Campaign parser, renderer, catalog and server personalization function
remain authoritative. Quotation grouping leaves Email/SMS groups unchanged.

| Group | Source |
| --- | --- |
| Recipient | The selected authorized Lead or Contact; both use `companyName` |
| Account | The recipient's authorized Account relationship; explicit `accountName` and `accountAddress` |
| Sender | Authenticated user's name, email and supported job title |
| Organization | Current tenant's Organization Settings name, address, email and phone |
| Quotation Details | Current document number, dates and total |

Account phone and organization logo are unavailable in the current schema.
Products use the fixed table instead of repeatable text variables. Unresolved
placeholders are preserved in reusable-template PDFs; final documents reject
unknown variables and missing required Account relationships.

The four steps are Recipient, Products, Quotation Details and Preview. Deal is
required and must be an authorized existing recipient relationship, including
a converted Lead's Deal when selecting its Contact. The Products review step
loads the Deal's canonical `productInterestId`; it does not offer manual Product
selection. Name, category, description and price come from that active tenant
Product record, rather than the Deal's historical value. A Deal without an
available Product blocks progression; a valid zero-priced Product remains allowed.
Quantities are positive whole numbers;
the backend uses decimal arithmetic for line totals and the grand total. There
are no taxes, discounts, shipping charges or editable price overrides.

## API and sending

Existing template CRUD supports Quotation records. Switching an existing template
between quotation and messaging formats is rejected.

| Endpoint | Behavior |
| --- | --- |
| `GET /marketing/templates/:id/pdf` | Download reusable PDF without selecting a recipient or Products |
| `POST /marketing/campaigns/quotations/preview` | Validate a draft; return document, PDF base64, filename and fingerprint |
| `POST /marketing/campaigns/quotations/send` | Check the reviewed fingerprint and send the generated attachment |

Draft requests contain IDs, quantities, dates and notes. Prices, totals, sender
and organization identity are resolved server-side. Campaign and CRM permissions,
Account visibility and Product visibility are enforced on the backend.

One PDFKit renderer creates A4 previews, downloads and attachments. Licensed Noto
Sans fonts are bundled under `backend/assets/fonts` and copied into the backend
container. Existing currency formatting retains its defaults; quotations opt into
two decimal places. PDF generation preserves page headings, wrapping and `₱`.

Sending extends the existing owned Gmail mailbox with one internal generated PDF
attachment. The selected recipient must still be assigned to the sending user,
including Client Admin. Existing mailbox authorization, durable claims, unknown
outcome recovery and activity ingestion remain in use. Frozen document context and
attachment identity are kept in the existing mailbox receipt for retries; JSONB
key ordering cannot change the send identity. Changed previews require regeneration
before the first attempt. Provider-confirmed sends remain sent if local history
ingestion is delayed.

New drafts require exactly one Product matching the selected Deal. Recipient or
Deal changes clear dependent Product/preview state; cache identity and aborted
requests prevent an old Deal response from replacing the current selection.
Unchanged Deal/Product selections retain quantities during Back/Next navigation.
The existing five-column PDF layout is retained; category is displayed in the
wizard's Product review table. Previously attempted receipts from before the
required-Deal contract recover their exact frozen draft and attachment; a new
send still requires current Deal/Product validation.

## Six starter templates

The existing seed command now includes Standard Sales Quotation, Service
Quotation, Software Implementation, Annual Maintenance, Product Quotation and
Custom Quotation. It requires an explicit confirmed tenant ID:

```powershell
npm --prefix backend run db:seed:campaigns -- <tenant-id>
```

For the built production image, use its compiled entry point. To add only missing
quotation starters while leaving Email/SMS rows byte-for-byte unchanged:

```powershell
npm --prefix backend run db:seed:campaigns:production -- <verified-tenant-id> --quotations-only
```

Resolve the intended tenant's ID from the verified production database first;
do not infer it from local seed fixtures or a different database. Matching edited
and archived quotation templates are retained, so an archived starter remains
absent from the active list. Seeding is an explicit operation, separate from
deployment and template listing; neither automatically seeds every tenant.

The transaction locks that tenant and preserves matching edited/archived rows.
Existing Email/SMS defaults remain unchanged. This command must target a database
whose identity has been verified; implementation verification seeds only disposable
databases, not a live workspace.

## Verification

- `node backend/scripts/test-quotations-disposable.mjs`: actual migrations,
  authenticated HTTP, persistence, template seeding, decimal calculations,
  variable sources, tenant/RBAC boundaries, Account visibility, stale previews,
  PDF attachments, concurrent clicks and uncertain provider outcomes. Gmail
  transport is mocked; successful tests do not establish real delivery.
- `node backend/scripts/preview-quotations-browser.mjs`: production frontend with
  isolated API fixtures at 320/375/390/430/768/1024/1440px. Covers tabs, cards,
  editing, unsaved changes, cursor insertion, the wizard and download/send controls.
  This is rendered UI preview evidence, separate from database-backed API tests.
- Existing Campaign, selector, currency and Gmail authorization regressions;
  quotation cursor insertion test; workspace lint/typecheck and builds.
- Generated PDFs are extracted and visually rendered to inspect placeholder
  preservation, peso text, single-page documents and long tables/terms.

Local evidence is written under ignored `data/outputs/quotations`. No production
deployment, live tenant seeding, OAuth connection or real Gmail delivery is
performed by these checks.

Recorded local results: 30 quotation/template checks, 71 frontend regressions,
79 existing Gmail checks and 14 Contact dependency/migration checks passed
(194 tests). The rendered UI preview passed 56 checks across all seven widths.
Workspace lint/typechecks, frontend/shared builds and the final backend build
passed. Builds used an explicit fixture `API_URL`; the default checkout does not
provide the production backend URL required by the existing build configuration.
Standard Lead/Contact/template PDFs each rendered as one page; a 10-page sample
verified repeated headings, long terms, placeholder rules and peso text.

## Compiled-runtime repair audit (2026-10-18)

The audited main revision was `cb7e80f164ece5245eb269587c296c7dfbaf9fcb`.
At inspection, public frontend, direct backend and proxied backend release
responses all reported that revision. Deployment mismatch was therefore ruled
out for that observation.

The compiled renderer reproduced `ENOENT` opening
`backend/dist/backend/assets/fonts/NotoSans-Bold.ttf`. Its existing module-relative
font path was correct for TypeScript sources, but the build omitted assets at
the corresponding compiled location. The Docker image separately copied fonts
to `backend/assets`, where the compiled module did not look. The backend build
now copies the licensed assets to `dist/backend/assets`; the existing Docker
copy of `dist` carries them into the image. No alternate renderer or font
fallback is introduced.

The six starters were already defined and valid. The existing seed was opt-in,
was not invoked by startup, and its TypeScript CLI was excluded from compiled
output and absent from the runner image. The existing CLI is now explicitly
compiled and available through the production command above. The quotation-only
option uses the existing tenant-lock transaction and skips Email/SMS creation
and legacy-token normalization. This fixes the operational seed path; the
production tenant's actual rows and prior seed execution must still be inspected
before attributing missing live starters to an unrun seed.

The existing Next proxy already uses `arrayBuffer()` and forwards PDF MIME type,
download metadata, status and authentication. Focused regressions verify exact
quotation bytes and JSON failure status; no proxy rewrite is needed. Existing
card preview/download, SideSheet, iframe, Blob, toast and four-step wizard remain
in use. Backend failures still reach the existing sanitized error middleware.

After a backend build, run `npm --prefix backend run test:quotations:runtime` to
verify packaged fonts, a real compiled-renderer PDF from an unrelated working
directory, and the compiled seed CLI's missing-scope guard. The disposable API
suite covers new-template PDFs, active-list availability, seed retention and
PDF authorization. The rendered UI fixture additionally checks newly saved
template preview/download, PDF failures and request counts at all seven widths.
Docker image execution and production container/log/database acceptance remain
separate checks; local results do not establish a corrected live deployment.

Repair validation: 32 disposable backend/API tests, 88 focused frontend/proxy
tests and two compiled-runtime checks passed. Workspace lint/typechecks passed.
The first parallel build exhausted its sandbox process memory; the sequential
retry completed all three workspace build tasks successfully. Visual extraction
and page review covered one-page template/Lead/Contact PDFs and a ten-page sample.
The browser fixture uses isolated API responses, not the production database.
All 70 checks passed at 320/375/390/430/768/1024/1440px, including native Chrome
PDF loading before screenshots, new-template previews/downloads, error toasts,
request counts, Lead/Contact selection, whole-number quantity validation and
retained wizard values when navigating backward. The fixture permits only the
built-in viewer's Chrome-internal resources through its network guard. Extracted
content from the newly created/edited template PDF included its persisted terms,
organization information, placeholders and peso amounts.

Production diagnostics remain incomplete: the configured local database is a
different Supabase target, no Coolify API credentials are configured, browser
access reports disabled, and the local Docker Linux engine is unavailable.
Camxian Technologies' production UUID, saved starter/custom/archive inventory,
container font paths, migration ledger and sanitized error logs must therefore
be checked through authenticated production access. Seed only that verified
tenant after inspecting existing rows; after deploying, confirm both PDF routes
and frontend downloads against the matching serving revision. No live seed,
database migration, deployment or Gmail delivery is established by this repair.

Repair files:

- Runtime packaging/entry point: `backend/package.json`, `backend/tsconfig.json`,
  `backend/start.js`, `infrastructure/docker/Dockerfile.backend`.
- Existing seed workflow: `backend/src/scripts/seed-campaign-templates.ts`,
  `backend/src/modules/marketing/templates/default-templates.ts`.
- Regression coverage: `backend/scripts/quotation-runtime.test.cjs`,
  `backend/scripts/preview-quotations-browser.mjs`,
  `backend/src/modules/marketing/campaigns/__tests__/quotations.test.ts`,
  `backend/src/modules/marketing/campaigns/__tests__/quotations.integration.test.ts`,
  `frontend/app/api/proxy/[...path]/__tests__/proxy-cookie-forwarding.test.ts`.
- This document. Concurrent Export CSV, table-settings and TableIconButton edits
  were preserved and are outside the quotation repair.

## Required Deal and canonical Product repair (2026-10-18)

The wizard previously saved an optional Deal ID without loading its Product;
the Products step depended on manual selection, and preview accepted any active
tenant Product. The existing Deal has one canonical `productInterestId` reference
to `ProductInterest`. Legacy arrays do not provide another quotation relationship.

The wizard now requires the related Deal and loads its Product through the
existing Deal detail API, identity-scoped cache and Product catalog hook. Existing
Label, red required markers, EntityCombobox and FieldError are reused. Optional
label/required attributes were added to EntityCombobox and optional cancellation
to `dealsApi.get`; no new components or endpoints were introduced. Only quantity
is editable. Missing/inactive Products block progression and do not become empty
zero-value quotations. Backend validation binds the single Product to that Deal,
uses existing active-Product validation and Decimal arithmetic, and checks the
reviewed data before a first send. Previously attempted legacy receipts retain
their frozen document and attachment identity.

The existing quotation-only seed and listing were verified with disposable
database/API tests. A tenant containing CCTV Quotation received the six starters;
all seven appeared across paginated reads and search/category queries. Repeated
seeding added nothing. Separate edited/archived retention checks left those rows
and Email/SMS content unchanged. Every starter and CCTV supported reusable PDF
generation and completed Deal/Product preview. This is not evidence that Camxian's
production database has been seeded.

Local verification passed 43 backend/API tests, 277 frontend regressions, all 13
final wizard tests (including cached Deals sharing one Product) and two compiled-
runtime checks. Workspace lint/typechecks and sequential builds passed. The final
frontend build also passed after an authorized retry outside the Windows sandbox;
its initial sandbox run failed creating a generated Next.js output directory.
The rendered browser fixture passed 182 checks across 320, 375, 390, 430, 768,
1024 and 1440px, including required-Deal errors, automatic Product metadata,
quantity validation, retained navigation, template actions and native Chrome PDF
preview. Browser responses are fixtures; Gmail transport is mocked in API tests.
PDF extraction verified Product details, decimal totals, placeholders and the peso
glyph; visual inspection covered a completed quotation, reusable template and
repeated headings in a ten-page long-text sample.

Current upstream was inspected at `f2bbf069f8b108dd009d4ba4a9c4c816d381a80a`;
its relevant Deal/Product relationship and quotation implementation were unchanged.
Public frontend, proxied backend and direct backend release/health responses all
reported that same revision during the final check. The local changes in this
repair have not been deployed.
Concurrent Campaigns/search edits in this checkout were preserved. The existing
Deal selector still exposes its first 50 authorized recipient relationships.

Files changed for this repair:

- `frontend/src/features/tenant/marketing/campaigns/ui/quotation-wizard.tsx` and
  its new `ui/__tests__/quotation-wizard.test.tsx`.
- `frontend/src/shared/components/entity-combobox.tsx` and
  `components/__tests__/entity-combobox-search.test.tsx`.
- `frontend/src/shared/services/deals.api.ts`.
- `shared/src/contracts/quotation.contract.ts` and its generated `.js` companion.
- `backend/src/modules/marketing/campaigns/quotations.service.ts` and
  `campaigns/__tests__/quotations.test.ts` / `quotations.integration.test.ts`.
- The existing `backend/scripts/preview-quotations-browser.mjs` fixture and this
  report. Its concurrent Email/SMS control checks remain intact.

Live completion remains blocked: browser inventory still reports browser access
disabled in Work settings. Camxian's production UUID, actual template inventory,
seed execution and serving PDF requests are unverified; no production rows were
changed. An initial automatic approval review failed on an account usage limit;
the authorized public release check subsequently completed successfully. Verify
authenticated production identity and existing rows before using the already
available tenant-scoped quotation-only seed, then repeat it and verify API/UI
counts and PDFs against matching deployed revisions.
