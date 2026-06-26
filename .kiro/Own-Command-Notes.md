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
# Root (runs both frontend + backend via Turborepo)
npm run dev                          # start everything (port 3000 + 4000)

# Frontend
cd frontend && npm run dev           # Next.js dev server (port 3000)
npx tsc --noEmit                     # type check only
npm run build                        # production build

# Backend
cd backend && npm run dev            # Express dev server (port 4000, ts-node-dev)
npx tsc --noEmit                     # type check only (0 errors required before commit)
npx prisma validate                  # validate schema syntax
npx prisma generate                  # regenerate Prisma client after schema change
npm run db:migrate                   # run pending migrations (creates tables)
npm run db:seed                      # seed system admin + default pipelines
npx prisma studio                    # visual DB browser at localhost:5555
```

---

## Backend API Route Map (85 routes, all under /api/v1/)

```
/auth          login · logout · me
/crm           contacts · companies · deals · pipelines · stages
/operations    tasks · service-orders
/marketing     campaigns · templates
/automation    workflows · actions · triggers
/billing       invoices · webhooks/paymongo
/administration users · roles · permissions · audit
/reporting     pipeline-summary · deal-velocity · contact-status · task-completion · campaign-summary
```

---

## Backend Architecture Rules

```
Controller  →  HTTP only (req/res/next) — no business logic
Service     →  Business logic — no req/res references
Repository  →  Prisma queries only — always include { tenantId }

tenantId    →  Always from req.user.tenantId (JWT) — NEVER from req.body
Audit log   →  writeAuditLog() after every mutation (fire-and-forget)
Plan limits →  enforcePlanLimit() before contact/deal create
Triggers    →  fire*() from triggers.service.ts after mutations (non-blocking)
Sessions    →  validateSession() on every authenticated request
```

---

## Key Backend File Paths

| What | Path |
|---|---|
| Prisma schema | `backend/prisma/schema.prisma` |
| Prisma client | `backend/src/config/database.config.ts` |
| Session service | `backend/src/core/auth/session.service.ts` |
| Audit service | `backend/src/core/audit/audit.service.ts` |
| Workflow engine | `backend/src/modules/automation/workflows/workflow.engine.ts` |
| Trigger helpers | `backend/src/modules/automation/triggers/triggers.service.ts` |
| Permission keys | `backend/src/shared/constants/permissions.ts` |
| Role constants | `backend/src/shared/constants/roles.ts` |
| Workflow types | `shared/src/contracts/workflow.contracts.ts` |
| API contracts | `shared/src/contracts/api.contracts.ts` |

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
