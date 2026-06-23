# LeadCRM AgentOS Power

A research-first, team-modeled SaaS engineering operating system for building production-grade CRM applications with Next.js 15, TypeScript, React Context, and multi-tenant SaaS architecture.

## What This Power Does

Enforces a disciplined, phased engineering workflow on every task. Turns Kiro into a full engineering team — Developer, Tech Lead, QA Engineer, Security Engineer, and Product Owner — all checking their respective domains before any work is considered done.

- **Researches before coding** — Phase 0 context analysis before any file is touched
- **Applies SOLID principles** — SRP, OCP, LSP, ISP, DIP mapped to React + TypeScript
- **Runs 5-role team review** — Developer, Tech Lead, QA, Security, Product Owner checklists
- **Classifies task severity** — LOW / MEDIUM / HIGH / CRITICAL, each requiring different rigor
- **Enforces SaaS safety** — tenantId on every record, RBAC on every action, audit log on every mutation
- **Validates before submitting** — 6 pre-submit gates + full Definition of Done

## Keywords

saas, crm, nextjs, typescript, react, multi-tenant, rbac, agentos, solid, engineering, research-first, clean-code, frontend, backend, audit, tenant, leadcrm, quality-gates, tdd, security

## When to Use

Activate this Power when working on any SaaS CRM project built with:
- Next.js 15 (App Router)
- TypeScript + React Context API
- Multi-tenant architecture with role-based permissions
- localStorage → Express + PostgreSQL migration path

## Steering Files

### Always Loaded (auto)

| File | Purpose |
|---|---|
| `project.md` | Supreme authority — AgentOS phases, agent routing, skill activation, response format |
| `standards.md` | SOLID principles, TypeScript rules, naming, file limits, design patterns, pre-commit checklist |
| `workflow.md` | Task lifecycle, 5-role team review, branch strategy, commit format, Definition of Done |
| `security.md` | Threat model, RBAC enforcement, tenant isolation, secret management, security protocol |
| `testing.md` | TDD workflow, coverage requirements, critical test cases, QA mindset |
| `lessons-learned.md` | Project-specific patterns, known pitfalls, accumulated team knowledge |

### On-Demand (manual — load with `#tag`)

| File | Tag | Purpose |
|---|---|---|
| `modes.md` | `#dev-mode` | Active implementation — pre-impl checklist, LeadCRM reminders |
| `modes.md` | `#review-mode` | Code review — all 5 role checklists, severity classification, report format |
| `modes.md` | `#research-mode` | Architecture decisions — evaluation criteria, decision output format |
| `modes.md` | `#performance` | Model selection, context window management, build troubleshooting |

## Agent Routing Matrix

| Task | Agent Sequence |
|---|---|
| Bug / unknown area | context-gatherer → general-task-execution |
| New feature | context-gatherer → requirement-detailer → general-task-execution |
| Architecture decision | context-gatherer → requirement-detailer → architecture-selection → general-task-execution |
| Refactor | context-gatherer → architecture-selection → general-task-execution |

## Skill Routing Matrix

| Work Type | Skills |
|---|---|
| Any code | `coding-standards` + `clean-code` |
| Frontend UI | + `frontend-patterns` + `nextjs-patterns` |
| New feature | + `saas-scalability` + `frontend-patterns` |
| API / backend | + `backend-patterns` + `saas-scalability` |
| Full error fix | All six skills |

## Task Severity

| Severity | Examples | Phases Required |
|---|---|---|
| LOW | Copy, styling, icon swaps, layout tweaks | Phase 0, checklist, report |
| MEDIUM | Forms, filters, hooks, new pages | Phases 0–1, checklist, report |
| HIGH | DataContext, RBAC, workflows, shared types | All phases |
| CRITICAL | Auth, billing, audit, tenant architecture | All phases + risk analysis doc |

## Engineering Team Model

Every task is reviewed through 5 lenses before it is done:

| Role | Owns |
|---|---|
| Developer | Clean code, SOLID, error handling, no duplication |
| Tech Lead | Pattern consistency, reuse, migration-readiness, SOLID |
| QA Engineer | All 6 test scenarios, UI states, regression coverage |
| Security Engineer | RBAC, tenantId, secrets, input validation, audit logs |
| Product Owner | Acceptance criteria, UX, dark mode, responsiveness |
