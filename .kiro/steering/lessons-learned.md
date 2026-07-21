---
inclusion: manual
description: Detailed pitfalls, sprint history, and schema v2 patterns. Load with # when debugging or reviewing past decisions.
---

# Lessons Learned — LeadCRM

## Architecture Patterns

- DataContext is the single source of truth for all data operations
- Filter state: multi-select = `string[]`, Smart Views (radio) = single `string`
- `useRef` for Context arrays in effects to avoid infinite re-render loops
- Config-driven UI: `Record<Status, config>` objects — no if/else chains
- `tenantId` never from user input — always `tenant.id` from AuthContext
- `tenant` from `useAuth()` — never from `useData()`
- Deal Details Modal = reusable `crm/pipeline/ui/deal-details-modal.tsx`
- Stage history auto-appends `previousStageId` on every `updateDeal` call
- Task assignment auditable: `addTask` seeds first record, `updateTask` appends on reassign
- Deal matching uses `contactIds` first, string matching is legacy fallback
- `store/types.ts` is a re-export shim only — never define types there

## Known Pitfalls

- `motion/react` NOT `framer-motion` — v12 export path changed
- Chart imports only from `ChartComponents.tsx` — never direct
- Tailwind v4: CSS-first, no `tailwind.config.js`. Tokens in `@theme {}`
- `prisma generate` required before first `npm run dev` on fresh clone
- npm install from monorepo root only — never inside frontend/ or backend/
- `viewport` export separate from `metadata` in `app/layout.tsx` (Next.js 15)
- str_replace on function headers leaves body orphaned — always read full function first
- Duplicate types in `store/types.ts` shadow canonical `store/types/*.ts` — use re-exports only
- `AnimatePresence` — only one wrapper per conditional block
- `tasks/addTask/updateTask` not in default PipelinePage destructure — add explicitly

## Module Conventions

- Contacts: linked via `organizationId`. Status: HOT|WARM|COLD|CANCELLED|CLOSED
- Pipeline: `stageId` from pipeline definition. Stages tenant-specific — never hardcode
- RBAC: `RolePermission` table — canView/canCreate/canEdit/canDelete per module. Unique [roleId, module]

## Performance
- `useMemo` for filtered lists >50 items
- Debounce search inputs at 300ms
- Pipeline uses `@dnd-kit` — do not swap without full rewrite

## Schema v2 Patterns (June 2026)

- DealAction = manual audit trail for deals. Creates DealAction + Activity + AuditLog per action.
- TargetAudience has NO junction table — contacts resolved dynamically via TargetAudienceCondition
- Subscription is billing source of truth — Tenant.plan is denorm cache. Update Subscription first, then sync Tenant.
- DealStageHistory.timeInPrevStage computed on insert (diff against previous row's movedAt)
- AuditLog.category required: auth|crm|billing|workflow|admin|system
- RolePermission replaces `permissions String[]` on RoleDefinition
- PERMISSION_BRIDGE: remove from `usePermissions.ts` when live API is active

## Multi-Tenancy
- tenantId enforced everywhere in DataContext already
- `USE_MOCK_DATA` flag in `src/lib/config.ts` — set false to use real API
- Each module migrates independently

## Auth
- `login()` returns `Promise<boolean>` — always `await`
- Detail views = drawers/sheets only — no `[id]` routes
