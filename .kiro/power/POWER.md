# LeadCRM AgentOS Power

A research-first, team-modeled SaaS engineering operating system for building production-grade CRM applications with Next.js 15, TypeScript, React Context, and multi-tenant SaaS architecture.

## What This Power Does

Enforces a disciplined, phased engineering workflow on every task. Turns Kiro into a full engineering team — Developer, Tech Lead, QA Engineer, Security Engineer, and Product Owner — all checking their respective domains before any work is considered done.

## Keywords

saas, crm, nextjs, typescript, react, multi-tenant, rbac, agentos, solid, engineering, research-first, clean-code, frontend, backend, audit, tenant, leadcrm, quality-gates, tdd, security

## Consolidated Structure (as of latest optimization)

All content has been merged and de-duplicated. The authoritative files are:

### Steering (auto-loaded every session)

| File | Purpose |
|---|---|
| `steering/project-core.md` | Tech stack, monorepo structure, module anatomy, non-negotiable rules |
| `steering/rules.md` | ALL hard constraints — UI, React, TypeScript, SaaS safety, anti-patterns, pre-commit checklist |
| `steering/security.md` | Threat model, RBAC, tenant isolation, secret management, security protocol |
| `steering/lessons-learned.md` | Project-specific patterns, known pitfalls, accumulated team knowledge |
| `steering/typescript-context.md` | Auto-injected on any `.ts`/`.tsx` file — inline active rules |

### Skills (on-demand, activate per task)

| Skill | Activate When |
|---|---|
| `workflow-process` | Any non-trivial task — AgentOS phases, agent routing, 5-role review, on-demand modes |
| `leadcrm-design-system` | Any UI work — color tokens, typography, component specs, layout rules |
| `frontend-patterns` | Frontend components, filters, charts, forms, RBAC guards |
| `nextjs-patterns` | App Router, client/server boundaries, dynamic imports |
| `backend-patterns` | Express, repository pattern, auth, Zod validation |
| `saas-scalability` | Multi-tenancy, plans, feature gating, domain events |
| `security-review` | Auth, RBAC, tenant isolation, input validation |
| `verification-loop` | Pre-PR / task completion — 7 gates, TDD, Definition of Done |

### Hooks (automatic triggers)

| Hook | Trigger | Action |
|---|---|---|
| `activate-on-task` | preTaskExecution | Prints AgentOS header + Phase 0 scan |
| `code-review-on-write` | postToolUse: write | Quick security + quality review |
| `quality-gate` | userTriggered | Full 5-gate quality check |
| `security-check-on-create` | fileCreated in auth/api/middleware/store | Security scan |
| `session-wrap` | agentStop | Capture new lessons learned |
