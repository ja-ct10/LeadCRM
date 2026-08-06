---
description: Project-specific patterns, known pitfalls, and accumulated team knowledge. Load manually with # when debugging or reviewing past decisions.
inclusion: manual
---

# LeadCRM — Lessons Learned

## Architecture Patterns

- `DataContext` is the single source of truth for all data operations
- Filter state: multi-select = `string[]`, Smart Views (radio) = single `string`
- `useRef` for Context arrays in effects to avoid infinite re-render loops
- Config-driven UI: `Record<Status, config>` objects — no if/else chains
- `tenantId` never from user input — always `tenant.id` from `AuthContext`
- `tenant` from `useAuth()` — never from `useData()`
- `DealDetailsModal` = reusable `crm/pipeline/ui/deal-details-modal.tsx`
- Stage history auto-appends `previousStageId` on every `updateDeal` call
- Task assignment auditable: `addTask` seeds first record, `updateTask` appends on reassign
- Deal matching uses `contactIds` first; string matching is legacy fallback
- `store/types.ts` is a re-export shim only — never define types there
- Frontend `pipelineService.archivePipeline` calls `PATCH /crm/pipelines/:id/archive` — always register a dedicated PATCH archive route; do NOT rely on `DELETE` for soft-deletes
- When a page imports `Tooltip` from both `ChartComponents` and `@radix-ui/react-tooltip`, alias the chart one: `import { Tooltip as ChartTooltip } from '...'` and the Radix one as `UITooltip` in pages that have both
- Icon-only toolbar pattern: wrap each button in `<TooltipProvider><Tooltip><TooltipTrigger asChild>` — `TooltipProvider` can wrap multiple `Tooltip` siblings to avoid redundant nesting

### Plain Error vs AppError in Express
The backend error middleware only formats `AppError` into clean JSON responses. Plain `new Error(...)` falls through to the generic 500 handler and returns "An unexpected error occurred." Always throw `new AppError(message, statusCode)` from services so the client receives meaningful error messages.

### Two-Step OTP Login Architecture
Real OTP login requires splitting the login into two endpoints: `POST /auth/send-otp` (validates credentials + emails code) and `POST /auth/verify-otp` (validates code + issues JWT). The `AuthContext.login()` now returns `true` to mean "OTP sent" not "logged in" — `verifyOtp()` completes the session. The `LoginOtpToken` model uses bcrypt hash of the code (never stores plaintext), tracks `attempts` for brute-force protection, and upserts so only one active OTP exists per email at a time.
The email reset link points to `/reset-password?token=...`. Without `app/reset-password/page.tsx`, Next.js returns 404. The token detection logic in `auth-page.tsx` only runs when the page actually renders — it can't intercept a missing route. Always create the route file alongside the UI logic.
On Resend's free plan without a verified custom domain, emails can only be delivered to the account owner's email. The `from` address is locked to `onboarding@resend.dev`. To send to any recipient, verify a domain in the Resend dashboard. Use `RESEND_FROM=LeadCRM <onboarding@resend.dev>` until domain is verified.
When a service depends on unconfigured external credentials (SMTP, etc.), don't throw immediately — check first and log a usable dev substitute (e.g. reset URL to console) instead of crashing the flow. Gate the real send behind a config check so the feature is fully testable in dev with zero external setup.
```typescript
if (!smtpConfigured) {
  if (process.env.NODE_ENV !== 'production') console.log('[DEV] Reset URL:', resetUrl);
  return; // skip send, token is already written to DB
}
await sendMail(...);
```

## Known Pitfalls

- `motion/react` NOT `framer-motion` — v12 export path changed
- Chart imports only from `ChartComponents.tsx` — never direct recharts
- Tailwind v4: CSS-first, no `tailwind.config.js` — tokens in `@theme {}`
- `prisma generate` required before first `npm run dev` on fresh clone
- `npm install` from monorepo root only — never inside `frontend/` or `backend/`
- `viewport` export separate from `metadata` in `app/layout.tsx` (Next.js 15)
- `str_replace` on function headers leaves body orphaned — always read full function first
- Duplicate types in `store/types.ts` shadow canonical `store/types/*.ts` — use re-exports only
- `AnimatePresence` — only one wrapper per conditional block
- `tasks/addTask/updateTask` not in default `PipelinePage` destructure — add explicitly

## Module Conventions

- Contacts: linked via `organizationId`. Status: `HOT | WARM | COLD | CANCELLED | CLOSED`
- Pipeline: `stageId` from pipeline definition. Stages are tenant-specific — never hardcode
- RBAC: `RolePermission` table — `canView/canCreate/canEdit/canDelete` per module. Unique `[roleId, module]`

## Performance

- `useMemo` for filtered lists > 50 items
- Debounce search inputs at 300ms
- Pipeline uses `@dnd-kit` — do not swap without full rewrite

## Schema v2 Patterns (June 2026)

- `DealAction` = manual audit trail for deals. Creates `DealAction` + `Activity` + `AuditLog` per action
- `TargetAudience` has NO junction table — contacts resolved dynamically via `TargetAudienceCondition`
- `Subscription` is billing source of truth — `Tenant.plan` is denorm cache. Update Subscription first, then sync Tenant
- `DealStageHistory.timeInPrevStage` computed on insert (diff against previous row's `movedAt`)
- `AuditLog.category` required: `auth | crm | billing | workflow | admin | system`
- `RolePermission` replaces `permissions String[]` on `RoleDefinition`
- `PERMISSION_BRIDGE`: remove from `usePermissions.ts` when live API is active

## Multi-Tenancy

- `tenantId` enforced everywhere in `DataContext` already
- `USE_MOCK_DATA` flag in `src/lib/config.ts` — set `false` to use real API
- Each module migrates independently

## Auth

- `login()` returns `Promise<boolean>` — always `await`
- Detail views = drawers/sheets only — no `[id]` routes

### Kiro Skills Live in .kiro/skills/, Not .agent/skills/
Kiro IDE only auto-activates skills from `.kiro/skills/<name>/SKILL.md`. Files in `.agent/skills/` are invisible to Kiro's skill system — they never appear as slash commands and are never auto-activated. Always use `.kiro/skills/` for any skill you want Kiro to use.

### Hook References Must Point to Files That Exist
A hook prompt referencing a path that doesn't exist (e.g. `.agent/workflows/`) silently fails — the agent reads nothing and reports "no issues found" incorrectly. Always verify every file path referenced in hook prompts is real before shipping.

### Steering Inclusion Modes Directly Affect Credit Usage
`inclusion: always` loads the file into every single session turn. Heavy files with code examples burn tokens fast. Move reference-heavy docs to `inclusion: manual` and activate them with `#filename` only when needed. Keep always-loaded steering files to rules and constraints — not examples.

### Two-Layer Services Pattern (HTTP client vs feature logic)
`src/shared/services/*.api.ts` = HTTP clients only (raw API calls, shared across modules).
`features/[module]/services/*.service.ts` = feature business logic only (orchestration, transforms).
Never duplicate API calls — if a feature service just wraps `apiClient`, delete it and use the shared API client directly. The split matters because `contacts.api.ts` can be used by both CRM and Marketing, but `contacts` feature business logic belongs only in CRM.

### Misplaced Files in Wrong Module's UI Folder
Files placed in `module-A/ui/` that actually belong to `module-B` are invisible to discovery tools and cause confusion. Specific case found: `assets-page.tsx` and `inventory-page.tsx` were duplicated inside `service-orders/ui/` — the real versions already existed in `operations/assets/ui/` and `operations/inventory/ui/`. Always check if a UI file already exists in its correct module before creating it inside an unrelated module's `ui/` folder.

### organizations.service.ts Belongs in companies/, Not contacts/
`crm/contacts/services/organizations.service.ts` is misplaced — organizations (companies) is a separate CRM module. Its service file belongs at `crm/companies/services/` or `shared/services/`. Contacts and companies share a relationship (`organizationId`) but are independent modules with independent service layers.

### smart_relocate Corrupts @/ Aliases Occasionally
After using `smart_relocate`, verify the updated import paths — the tool sometimes generates `@/src/features/...` instead of `@/features/...` when the tsconfig paths alias points to `src/`. Always run `get_diagnostics` on the affected file immediately after any `smart_relocate` operation and fix manually if the alias is wrong.

### Feature Slice Public API (index.ts is Non-Negotiable at Scale)
Every feature slice must expose an `index.ts` that exports only what outside consumers need. Without it, anything can import internals — silent coupling builds up and refactors become dangerous. This is the #1 rule from Feature-Sliced Design and applies now.
```typescript
// crm/contacts/index.ts — export only the public surface
export { ContactsPage } from './ui/contacts-page';
export type { Contact } from './types/contact.types';
// internal hooks, helpers, sub-components stay unexported
```

### DataContext God Object Is the #1 API Migration Risk
A single DataContext holding all domains (contacts, deals, campaigns, tasks, invoices...) is an anti-pattern at scale. When migrating to real API, split by domain: server data → TanStack Query per feature, URL state → useSearchParams, UI state → useState, global UI (theme/sidebar) → Context only. Restructuring this early saves significant pain later.

### Feature api/ vs shared/services/ — Pick One Per Domain
Never have both `features/[module]/services/` and `shared/services/` serving the same domain. The correct split: `features/[module]/api/` owns the HTTP client for that domain; `shared/services/` is only for truly cross-cutting API utilities (auth, notifications). Mixing both creates duplicate maintenance burden.

### PascalCase Exception: ChartComponents.tsx and Context Files
Two files intentionally keep PascalCase despite the kebab-case rule:
- `ChartComponents.tsx` — the steering rule names it explicitly as the canonical import; renaming breaks every chart import
- `AuthContext.tsx` / `DataContext.tsx` — foundational Context files referenced by name in steering docs; React convention + high blast-radius

All other `.tsx/.ts` files must be kebab-case. These three are permanent exceptions.

### Page Components Belong in ui/, Not at Module Root
Page components (e.g. `contacts-page.tsx`) must live inside `[module]/ui/`, not at the module root. The module root should only contain `index.ts`. The App Router shell in `app/` imports via the `index.ts` barrel, which then points to `ui/`. This ensures the module's public API stays controlled through one file.

### LandingPage Was Orphaned — Wire It to app/page.tsx
`LandingPage` was in `tenant/pages/` with no consumers. The correct connection is `app/page.tsx` using `dynamic(() => import(...), { ssr: false })` with a `useRouter`-based `onNavigate` adapter. The root page should show the landing page, not redirect to `/login`.

### smart_relocate Leaves Stale Exports in index.ts
When `smart_relocate` moves files out of a folder (e.g. removing duplicate `assets-page.tsx` and `inventory-page.tsx` from `service-orders/ui/`), it does NOT clean up any `index.ts` that re-exported those files. The index silently keeps pointing to non-existent paths. Always audit `index.ts` contents after any `smart_relocate` batch operation.

## Adding a New Lesson

When something non-obvious is discovered, append it here:

```markdown
### [Pattern Name]
Brief description of what was learned and why it matters.
Code example if helpful.
```

### All App Router Route Shells Must Use dynamic() with ssr: false
Every `app/(tenant)/*/page.tsx` and `app/(system-admin)/*/page.tsx` must use `dynamic(() => import(...), { ssr: false })` — never a static `import`. Static imports cause SSR attempts on client-only SPA components, breaking the build. The rule applies even when a prop needs wiring (e.g. `navigate`, `activeTabProp`) — in those cases the shell is still `'use client'` + `dynamic`, with the prop wired inside a thin wrapper function.
```tsx
// Correct — simple page
'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../../src/features/tenant/crm/contacts/ui/contacts-page'), { ssr: false });
export default Page;

// Correct — page needing a prop
'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
const PipelinePage = dynamic(() => import('../../../../src/features/tenant/crm/pipeline/ui/pipeline-page'), { ssr: false });
export default function PipelineRoute() {
  const router = useRouter();
  return <PipelinePage navigate={(path) => router.push(path)} />;
}
```

### next-auth Middleware Causes Redirect Loops in Mock Auth Mode
Using `withAuth` from `next-auth` in `middleware.ts` breaks the app when `USE_MOCK_AUTH=true` because there is no NextAuth session — every request gets redirected to `/login`. Since `AuthGuard` already handles client-side route protection correctly for both mock and real-API modes, the middleware should be a passthrough. Only add server-side token inspection to middleware when the app is fully on real NextAuth sessions.

### PowerShell Regex on TSX Files Causes Catastrophic Corruption
PowerShell's `-replace` with capture groups (`$_.Groups[1].Value`) in a scriptblock substitution does NOT work reliably on multiline TSX catch blocks. It injects the capture group variable name literally (`$ws`, `$msg`) and then appends the entire file contents again as the substitution — resulting in a file duplicated 10-30× with garbage injected at every catch site. **Never use PowerShell scriptblock substitutions on source files.** Use only simple `.Replace('literal', 'literal')` or the `str_replace` tool for surgical edits. Recovering requires extracting the last clean copy from the duplicated file by finding the final occurrence of `export default function` and working backwards to `'use client';`.

### Frontend ActivityType Must Exactly Match Backend Zod Enum
The frontend `ActivityType` union in `store/types/shared.types.ts` must be a character-for-character match of the backend `z.enum([...])` in `activities.dto.ts`. Kebab-case frontend values (`'deal-created'`, `'stage-change'`) vs snake_case backend values (`'deal_action'`, `'stage_change'`) cause a Zod validation error at the API boundary. The source of truth is the backend DTO — always sync the frontend type to it, not the other way around. Also: non-standard values like `'user_action'` and `'system'` passed through `as any` bypass TypeScript but still fail at runtime.

### Never Share Credentials in Chat
Database passwords, JWT secrets, and API keys shared in chat are compromised the moment they're sent — they appear in conversation history and logs. Always rotate any credential shared this way immediately. Use environment variables exclusively; reference them by key name (e.g. `DATABASE_URL`) never by value.

### Batch API Fetches in loadData for Performance
When migrating modules from localStorage to real API, fetch all modules in parallel batches using `Promise.all` rather than sequential awaits. Group by failure domain (CRM core vs. secondary modules) so one failing module doesn't block the others from loading.
```typescript
// Batch 2 — independent modules, one failure won't block Batch 1
const [tasksRes, soRes, workflowsRes, ...] = await Promise.all([
  tasksApi.list({ limit: 500 }),
  serviceOrdersApi.list({ limit: 500 }),
  workflowsApi.list({ limit: 500 }),
]);
```

### API Client Must Use credentials: 'include' for HttpOnly Cookie Auth
When the backend uses HttpOnly cookie-based JWT auth (not Bearer tokens), the frontend fetch client MUST include `credentials: 'include'`. Without it, the browser never sends the `leadcrm_token` cookie, the backend sees an unauthenticated request, and either returns 401 or returns data for the wrong/no tenant. The `getSession()` from `next-auth/react` is irrelevant when the app uses a custom JWT — remove it and rely solely on the cookie. CORS must also have `credentials: true` on the backend (already set in `app.ts`).
```typescript
// WRONG — getSession() returns null for custom JWT auth
const session = await getSession();
headers['Authorization'] = `Bearer ${session?.accessToken}`;

// CORRECT — cookie is sent automatically by the browser
const res = await fetch(`${API_URL}${path}`, {
  credentials: 'include', // sends HttpOnly leadcrm_token cookie
  headers: { 'Content-Type': 'application/json' },
});
```

### Backend Login Response Must Include tenantId
`auth.service.ts loginUser()` was returning `id, email, role, firstName, lastName` but omitting `tenantId`. The frontend `AuthContext` reads `res.data.user.tenantId` to set the `tenant` state after login — without it, `tenant` stays `null`. Every DataContext operation that guards on `tenant` then silently fails or shows empty state, even though the backend queries work correctly (JWT cookie has the correct tenantId). Always include `tenantId` in any user response used for session hydration.

### /auth/me Must Return Full User from DB, Not Raw JWT Payload
The JWT payload only contains `userId, tenantId, role, email` — no `firstName` or `lastName`. If `/auth/me` returns `req.user` directly, the frontend session restore (`restoreSession()`) gets a partial user object missing display names. Fix: query the `User` table by `userId + tenantId` and return the full user shape. This is also a security benefit — you confirm the user still exists in the DB on every session restore.
```typescript
// WRONG — raw JWT payload, no firstName/lastName
res.json({ success: true, data: { user: req.user } });

// CORRECT — full user from DB
const user = await prisma.user.findFirst({
  where: { id: req.user!.userId, tenantId: req.user!.tenantId },
  select: { id: true, email: true, role: true, firstName: true, lastName: true, tenantId: true },
});
res.json({ success: true, data: { user } });
```

### Two-Step OTP Login Architecture
Login uses a split endpoint pattern: `POST /auth/send-otp` (verifies credentials + emails code) and `POST /auth/verify-otp` (validates code + issues JWT). The `login()` function in AuthContext only triggers the OTP send — `verifyOtp()` is a separate context function called after code entry. This keeps credential verification and session issuance decoupled.

### Reset Password Route Must Exist as a Next.js Page
The email reset link points to `/reset-password?token=...`. Without `app/reset-password/page.tsx`, Next.js returns 404. The token detection logic in `auth-page.tsx` only runs when the page actually renders — it can't intercept a missing route. Always create the route file alongside the UI logic.

### ActivityType Union Must Match All Consumers
`ActivityType` in `store/types/shared.types.ts` must include every string key used in `activity-timeline.tsx`'s icon/color maps. Both hyphenated (`stage-change`) and underscore (`stage_change`) variants must be in the union if both are used. Missing variants cause `Record<ActivityType, ...>` compile errors. Always update the type when adding a new activity variant.

### config.ts Must Read Env Vars — Never Hardcode Flag Values
`USE_MOCK_DATA` was hardcoded to `false` in `lib/config.ts` instead of reading `process.env.NEXT_PUBLIC_USE_MOCK_DATA`. This meant the env var in `.env.local` had no effect. Always use `process.env.NEXT_PUBLIC_X !== 'false'` pattern — never hardcode boolean feature flags.

### Seeder Field Names Must Match Prisma Schema Exactly
Seeder fields like `probability`, `contactIds`, `createdById`, `entity`, `details` don't exist on `Deal`, `Task`, and `AuditLog` models. Correct names: no `probability` on Deal, use `contactId` (singular), `assignedById` on Task, `entityType` + `metadata` on AuditLog. Always verify against `schema.prisma` before writing seed data.

### Duplicate Email Accounts Across Tenants Break findFirst Login
`loginUser` uses `prisma.user.findFirst({ where: { email } })` — if the same email exists in multiple tenants (e.g. registered twice), it picks whichever row was inserted first. The picked row may have a different password hash. Fix: always query with both `email` AND `tenantId`, or enforce global email uniqueness. For password resets, same issue applies.

### Prisma Enum Values Are UPPER_SNAKE_CASE
Prisma enums must match the schema exactly. `CampaignType` uses `EMAIL` not `'Email'`, `CampaignStatus` uses `ACTIVE/DRAFT/COMPLETED` not `'Active'`. TypeScript will catch this at compile time — always check the enum definition in `schema.prisma` or `node_modules/.prisma/client/index.d.ts` before seeding.

### Activity Has No relatedToType/relatedToId Fields
The `Activity` model uses direct FK columns (`contactId`, `dealId`, `organizationId`, `taskId`, `invoiceId`) — not a polymorphic `relatedToType`/`relatedToId` pattern. Only one FK should be non-null per activity row.

### ServiceOrder Uses assignedTechnicianId, Not assignedUserId
The field is `assignedTechnicianId` (references `User.id`). Also: `scheduledDate` not `scheduledAt`, no `type`/`priority`/`estimatedHours` fields on the model.

### Contact.customerType vs Organization.customerType Are Different Unions
`Contact.customerType` is `'Individual' | 'Organization'` (classification type), while `Organization.customerType` is `'Prospect' | 'Active Customer' | 'Inactive Customer' | 'Former Customer'` (relationship status). They share the same field name but have completely different value sets. When filtering "customers", use `Contact.status === 'Closed'` — not `customerType === 'Active Customer'` which only exists on `Organization`.

### productInterests Plural vs productInterest Singular (Silent Data Loss)
The frontend Contact type uses `productInterests: string[]` (plural array). The backend DTO and Prisma schema also use `productInterests`. But the contact adapter used `productInterest` (singular string) for mapping — causing the field to never reach the backend and never restore after a fetch. Always verify adapter key names match both the frontend type AND the backend DTO. A mismatch causes silent data loss with no TypeScript error.
```ts
// WRONG — key mismatch, silently drops the field
result.productInterest = data.productInterests;

// CORRECT
result.productInterests = data.productInterests;
```

### Never Pass Mock/Hardcoded Stage IDs to the Backend
`UpdateDealSchema` uses `z.string().cuid()` for all ID fields — including `stageId`. Hardcoded mock IDs like `'stage_lost'` or `'stage_won'` will always fail backend validation with "Invalid cuid". Always look up the real stage from the pipeline before calling any deal mutation:
```typescript
const lostStage = pipeline?.stages.find(s => s.name === 'Closed Lost' || s.isLost);
```
Also: moving a deal to "Closed Lost" must use `moveDealStage()` (the `/deals/:id/stage` endpoint), not `updateDeal()`. Calling `updateDeal` with only `{ lostReason }` saves the text but does not change the stage on the backend.

### Strip Empty Strings from CUID Fields in Adapters
Form state initializes optional ID fields as `''` (e.g. `assignedUserId: deal.assignedUserId || ''`). When the full form object is spread into `updateDeal`, those empty strings reach the backend and fail `z.string().cuid()` validation — same error as a mock ID. The fix belongs in the adapter layer, not the call site: use truthiness guards instead of `!== undefined` for all CUID fields.
```typescript
// BAD — passes '' which fails .cuid()
if (data.stageId !== undefined) updateData.stageId = data.stageId;

// GOOD — empty string is falsy, so it's silently dropped
if (data.stageId) updateData.stageId = data.stageId;
```

### Exclude Uneditable Fields Before Spreading EditFields
If an edit form does not expose a field (e.g. `stageId` in `DealDetailsModal`), that field must be explicitly excluded before spreading `editFields` into an update payload. Otherwise the form's initialized value (a potentially stale or mock ID) gets sent to the backend on every save.
```typescript
// BAD — stageId spreads through even though no stage selector exists
onUpdateDeal(deal.id, { ...editFields });

// GOOD — destructure it out
const { stageId: _stageId, ...editableFields } = editFields;
onUpdateDeal(deal.id, { ...editableFields });
```

### DragOver Must Not Call the Backend
`onDragOver` fires on every pixel of cursor movement during a drag. Calling `updateDeal` inside it creates an API call storm and causes race conditions. All persistence must happen exclusively in `onDragEnd`. Use `onDragOver` only for local visual state (drag overlay, column highlighting).

### The Real "Invalid cuid" Source — Deal ID Itself, Not the Payload
After multiple rounds of patching payload fields, the error persisted because the **deal `id` in the URL** was the invalid value — not any field in the request body. Seeded records with IDs like `rey-deal-1` exist in Postgres but Prisma's `findFirst({ where: { id } })` validates the ID format before querying, throwing "Invalid cuid" even for a simple lookup. Patching the frontend adapter never helps when the root is a bad primary key in the database. Always check the request URL in the network tab first — the path param is validated too.

### CUID vs UUID — Prefer UUID for Prisma Projects
`@default(cuid())` creates a dependency on Prisma's internal CUID generator and requires `z.string().cuid()` validation in all Zod DTOs. Any hardcoded seed ID or legacy string that doesn't match CUID format will fail silently at the DB layer. UUID (`@default(uuid())` + `z.string().uuid()`) is the safer standard: natively supported by PostgreSQL, universally recognized, and tolerant of human-readable seed IDs during development. Migration is mechanical: replace all `@default(cuid())` in schema and all `z.string().cuid()` in DTOs, run a migration, and re-seed.

### ID Format Validation Belongs in the DB, Not in Zod DTOs
`z.string().uuid()` and `z.string().cuid()` in Zod DTOs reject any ID that doesn't match the current format — breaking all existing records whenever the ID strategy changes. ID format is not a business rule; referential integrity is enforced by the database. Use `z.string().min(1)` for all FK/reference fields in DTOs.
```typescript
// BAD — breaks when IDs are CUIDs and schema expects UUIDs (or vice versa)
stageId: z.string().uuid()

// GOOD — accepts any non-empty string; DB enforces FK validity
const id = () => z.string().min(1);
stageId: id()
```

### Render devDependencies Strip Problem
Render runs its own `npm install` (production-only) **before** executing the build script, stripping all `devDependencies` including `@types/*` and `typescript`. The `--include=dev` flag in the build command does not help because Render's pre-install already ran. The only reliable fix: move `@types/*` and `typescript` into `dependencies` in `backend/package.json` so they always install.
```json
// backend/package.json — move these to dependencies, not devDependencies
"@types/node": "^22.14.0",
"@types/express": "^5.0.1",
"@types/bcryptjs": "^2.4.6",
"@types/cors": "^2.8.17",
"@types/cookie-parser": "1.4.10",
"@types/jsonwebtoken": "^9.0.9",
"@types/nodemailer": "^8.0.1",
"typescript": "~5.8.2"
```

### Exclude Seeders from Production TypeScript Build
Seeder files use `@faker-js/faker` and other dev-only packages. Including them in the TypeScript compile causes build failures on platforms that strip devDependencies. Always exclude seeders from `tsconfig.json`:
```json
"exclude": ["node_modules", "dist", "src/database/seeders"]
```
Having the same package in both `dependencies` and `devDependencies` — npm resolves to the `devDependencies` entry, which then gets stripped on production installs.

### Turbo.json env Whitelist Required for Vercel
Vercel with Turborepo requires all environment variables used during build to be declared in `turbo.json` under `tasks.build.env`. Missing entries causes a warning and the variables won't be available, breaking auth and API connections.

### Non-UTF-8 Characters Break Vercel Webpack Build
A single non-printable character (e.g. a Windows em-dash `—` pasted from rich text) in a `.tsx` file causes `stream did not contain valid UTF-8` and kills the entire Vercel build. Fix with PowerShell: `$content -replace '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '-'` then write back as UTF-8 without BOM.

### Schema Drift — Missing Columns After Deploy
When `prisma migrate deploy` says "No pending migrations" but columns are missing, the schema has drifted beyond what the migration files capture. Root cause: columns were added directly to `schema.prisma` without creating migration files. Fix options: (1) delete and recreate the database for a clean slate, or (2) run `npx prisma migrate dev --name add_missing_columns` locally to generate a new migration file, then push. Always generate migration files when changing schema — never rely on `db push` for production.
