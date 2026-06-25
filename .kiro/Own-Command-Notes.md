# LeadCRM — Developer Quick Reference

> Personal command notes and quick lookups. Not loaded by any agent — manual reference only.

---

## Git Workflow

```bash
# Current branch
git branch --show-current

# Status
git status --short

# Stage specific files (never git add .)
git add path/to/file.tsx

# Commit with correct format
git commit -m "feat(contacts): add country filter with multi-select state"

# Push with tracking
git push -u origin dev-copy-1

# Switch branches
git checkout dev
git checkout dev-copy-1

# Merge dev-copy-1 into dev
git checkout dev && git merge dev-copy-1 --no-edit && git push
```

## Commit Types

| Type | When |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change, no behavior change |
| `docs` | Documentation only |
| `style` | Dark mode, Light Mode, color fixes, visual-only |
| `chore` | Config, deps, cleanup |
| `perf` | Performance improvement |
| `security` | Security fix or hardening |

---

## Dev Commands

```bash
# Frontend
cd frontend && npm run dev       # start dev server (port 3000)
npx tsc --noEmit                 # type check only
npm run build                    # production build

# Backend
cd backend && npm run dev        # start backend (port 4000)
npx prisma migrate dev           # run pending migrations
npx prisma generate              # regenerate client after schema change
npx ts-node prisma/seed.ts       # seed the database
```

---

## Agent Routing Cheat Sheet

| Task | Agent Sequence |
|---|---|
| Bug / unknown area | context-gatherer → general-task-execution |
| New feature | context-gatherer → requirement-detailer → general-task-execution |
| Architecture decision | context-gatherer → requirement-detailer → architecture-selection → general-task-execution |
| Refactor | context-gatherer → architecture-selection → general-task-execution |
| Multi-file error fix | context-gatherer → general-task-execution |

## Skills to Activate by Work Type

| Work Type | Skills |
|---|---|
| Any code | `coding-standards` + `clean-code` |
| Frontend/UI | + `frontend-patterns` + `nextjs-patterns` |
| New feature | + `saas-scalability` + `frontend-patterns` |
| API/backend | + `backend-patterns` + `saas-scalability` |
| Security/RBAC | + `security-review` |
| Tests/TDD | + `tdd-workflow` |
| Before PR | `verification-loop` |

---

## CRM Module Map

```
CRM              → Contacts · Companies · Deals · Pipeline
Marketing        → Campaigns · Email Templates
Operations       → Service Orders · Tasks · Assets · Inventory
Automation       → Workflows · Triggers · Actions · Execution Logs
Billing          → Invoices · Payments
Reporting        → Lead Sources · Revenue Attribution · Sales Reports
Administration   → Users · Roles · Permissions · Audit Logs
System Admin     → Tenants · Plans · Billing Monitor · Environment Health
```

---

## Key Paths

| What | Path |
|---|---|
| CRM portal features | `frontend/src/features/tenant/` |
| Admin portal features | `frontend/src/features/system-admin/` |
| Shared UI components | `frontend/src/shared/components/` |
| ShadCN primitives | `frontend/src/shared/components/ui/` |
| Charts (only source) | `frontend/src/shared/components/charts/ChartComponents.tsx` |
| Global state | `frontend/src/store/DataContext.tsx` |
| Auth state | `frontend/src/store/AuthContext.tsx` |
| Type definitions | `frontend/src/store/types/` |
| Mock data | `frontend/src/store/mockData/` |
| Route map | `frontend/src/shared/lib/route-map.ts` |
| Global CSS | `frontend/src/index.css` |
| Logo | `frontend/public/leadcrm_logo.png` |

---

## Non-Negotiable Quick Rules

| Rule | Value |
|---|---|
| Filter UI | Always `<TrelloFilter>` — never raw `<select>` |
| Filter button label | Always "Filter" |
| Multi-select state | Always `string[]` |
| Chart imports | Only `ChartComponents.tsx` |
| Animation imports | Only `motion/react` |
| Dark mode | Every element — no exceptions |
| tenantId | On every data record |
| Audit log | On every mutation |
| RBAC guard | Before every create/edit/delete UI element |
| deal.contactIds | Always `string[]` — never singular `contactId` |
