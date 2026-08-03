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

## Adding a New Lesson

When something non-obvious is discovered, append it here:

```markdown
### [Pattern Name]
Brief description of what was learned and why it matters.
Code example if helpful.
```
