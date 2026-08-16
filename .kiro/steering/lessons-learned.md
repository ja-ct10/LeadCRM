---
description: Project-specific patterns, known pitfalls, and accumulated team knowledge. Load manually with #lessons-learned when debugging or reviewing past decisions.
inclusion: manual
---

# LeadCRM — Lessons Learned

## Architecture & Data Flow

- `DataContext` is central state store — dual mode (mock localStorage / real API)
- `tenantId` always from JWT (AuthContext) — never user input
- `DealDetailsModal` = single reusable modal at `crm/pipeline/ui/deal-details-modal.tsx`
- `store/types.ts` is a re-export shim only — canonical types in `store/types/`
- Two-layer services: `shared/services/*.api.ts` (HTTP) + `features/[module]/services/` (logic)
- Feature slices need `index.ts` public API — prevents silent coupling

### DataContext God Object
Single DataContext holding all domains is the #1 API migration risk. Future: split into TanStack Query per feature, URL state → useSearchParams, UI state → useState, global UI → Context only.

### Navigation Sources
`use-layout.ts` is the **live** sidebar (consumed by `sidebar-nav.tsx`). `crm-layout.tsx` has a second richer nav array that is dead code. `command-palette.tsx` has a third copy.

## Backend Patterns

- Always throw `AppError(message, statusCode)` — plain `Error` gives generic 500
- `/auth/me` must query DB for full user — raw JWT payload lacks firstName/lastName
- Login response must include `tenantId` — without it, frontend tenant state stays null
- `moveDealStage` is the governed path (writes history + activity + triggers). `updateDeal` with stageId bypasses all governance
- ID format validation belongs in DB (FK), not Zod DTOs — use `z.string().min(1)` for all FKs
- `prisma migrate deploy` for applying existing migrations — `migrate dev` for authoring new ones
- When unconfigured external service (SMTP etc.): log dev fallback instead of crashing

### Stage Has No tenantId (Security Gap)
`Stage` scoped only through Pipeline join. `moveDealStage` resolves target stage without tenant filter. Validate via `{ id: newStageId, pipeline: { tenantId } }`.

## Frontend Patterns

- `useRef` for Context arrays in effects to prevent infinite re-render loops
- Config-driven UI: `Record<Status, config>` objects — no if/else chains
- `AnimatePresence` — one wrapper per conditional block
- SideSheet must use `createPortal(content, document.body)` to escape layout stacking context
- Early returns hide sibling portaled components — co-render in same Fragment

### DragOver Must Not Call Backend
`onDragOver` fires on every pixel. All persistence in `onDragEnd` only.

### ActivityType Must Match Backend Exactly
Frontend union must be character-for-character match of backend Zod enum. Kebab vs snake case causes runtime Zod validation failures.

### Campaign Status Case Mismatch
Backend enum: `ACTIVE`, `PAUSED` (uppercase). Frontend: mixed case. Use `.toLowerCase()` for all status comparisons.

## Prisma & Database

- `prisma generate` required before first dev run on fresh clone
- Nested create: when child model has own `tenantId` relation, must include `tenantId` on each child
- Enum values must match schema exactly (uppercase): `EMAIL` not `'Email'`
- `Activity` uses direct FK columns (`contactId`, `dealId`, etc.) — not polymorphic
- `ServiceOrder` uses `assignedTechnicianId` (not `assignedUserId`), `scheduledDate` (not `scheduledAt`)
- Relation field name in schema = include key in queries (may differ from model name after rename)
- After CRM split: `Account` has `leads[]` + `customers[]`, not `contacts[]`
- `Customer` has no `isArchived`/`deletedAt` fields — archive via status change

### Hand-Written Migrations Must Be Idempotent
Use `DO $$ BEGIN/EXCEPTION WHEN duplicate_object` for ADD CONSTRAINT. CREATE TABLE/INDEX have IF NOT EXISTS built in.

## Auth & Security

- API client must use `credentials: 'include'` — without it, browser never sends cookie
- `getSession()` from next-auth is irrelevant for custom JWT — rely solely on cookie
- Two-step OTP: `send-otp` (validates + emails code) then `verify-otp` (issues JWT)
- `DEV_OTP_BYPASS=true` + `DEV_SEED_EMAILS` in `.env` for local testing with seed accounts
- Rate limit values must match their comments (audit regularly)
- Split rate limiters by threat surface (login vs register vs password reset)

## Deployment & CI

- Render free tier blocks outbound SMTP (ports 587/465) — use HTTP email APIs (Resend)
- Render strips devDependencies — move `@types/*` and `typescript` to `dependencies`
- Exclude seeders from tsconfig: `"exclude": ["src/database/seeders"]`
- `turbo.json` env whitelist required for Vercel build vars
- ALLOWED_ORIGINS must include deployed frontend URL exactly
- Dashboard env vars: never wrap in quotes (literal storage, unlike dotenv)
- CI: run `prisma generate` after `npm ci`, before `tsc --noEmit`
- `next lint` deprecated in Next.js 15+ — use `tsc --noEmit`
- npm workspaces: single `package-lock.json` at root, CI cache must point there

### Windows: prisma generate fails while dev servers run
`ts-node-dev`/Next dev holds query engine DLL open. Stop dev servers before building.

## Adapters & Forms

- Adapter key names must match both frontend type AND backend DTO — mismatch = silent data loss
- Strip empty strings from CUID/UUID fields in adapters (falsy guard, not `!== undefined`)
- Exclude uneditable fields before spreading form data into update payload
- Frontend Zod schemas must mirror backend DTOs (min lengths, formats)

## Tooling & Git

- `smart_relocate` occasionally corrupts `@/` aliases — run `get_diagnostics` after
- `smart_relocate` doesn't clean up stale exports in `index.ts`
- PowerShell regex substitution corrupts multiline TSX — use `str_replace` tool instead
- `file_search` index can be stale — verify with filesystem when edits fail
- Kiro skills live in `.kiro/skills/` only — `.agent/skills/` is invisible
- Hook file paths must point to files that exist
- `GIT_EDITOR=true` to skip vim in non-interactive rebase

## Adding a New Lesson

```markdown
### [Pattern Name]

Brief description of what was learned and why it matters.
Code example if helpful.
```
