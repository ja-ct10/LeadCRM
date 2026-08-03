# LeadCRM AgentOS Power

A research-first, team-modeled SaaS engineering operating system for building production-grade CRM applications with Next.js 15, TypeScript, React Context, and multi-tenant SaaS architecture.

## Keywords

saas, crm, nextjs, typescript, react, multi-tenant, rbac, agentos, engineering, research-first, clean-code, frontend, backend, audit, tenant, leadcrm, quality-gates, tdd, security

## Structure (Optimized — August 2026)

All content is now in `.kiro/` following Kiro's native workspace standard.

### Steering (auto-loaded every session — `inclusion: always`)

| File | Purpose |
|---|---|
| `product.md` | Identity, dev commands, API route map, ports |
| `tech.md` | Full tech stack table with versions and constraints |
| `structure.md` | Monorepo layout, file naming, import rules |
| `architecture.md` | Layer contracts, RBAC, Six-Pillar Rule, patterns |
| `coding-standards.md` | TypeScript, React, SaaS safety, anti-patterns, size limits |
| `security.md` | Auth, RBAC, tenant isolation, secrets, rate limits |
| `ui-ux.md` | Design tokens, typography, motion specs, dark mode |
| `testing.md` | TDD cycle, RBAC/tenant test patterns, coverage minimums |
| `skill-routing.md` | Auto-activate matrix for skills and sub-agents |

### Steering (manual — load with `#name` in chat)

| File | Load When |
|---|---|
| `lessons-learned.md` | Debugging, reviewing past decisions, recalling pitfalls |
| `deployment.md` | Docker, CI/CD, infrastructure, migration work |

### Skills (on-demand — activate per task type)

| Skill | Activate When |
|---|---|
| `crm-patterns` | CRM modules, deal pipeline, workflow engine, campaigns |
| `leadcrm-design-system` | Any UI work — tokens, component specs, layout |
| `frontend-patterns` | Components, filters, charts, forms, RBAC guards |
| `backend-patterns` | Express, repository pattern, auth, Zod validation |
| `saas-scalability` | Multi-tenancy, plans, feature gating, domain events |
| `security-review` | Auth, RBAC, tenant isolation, input validation |
| `verification-loop` | Pre-PR quality gate — 7 gates, Definition of Done |
| `workflow-process` | Non-trivial tasks, architecture decisions, 5-role review |
| `react-patterns` | React hooks, component composition, forms |
| `react-performance` | Re-renders, bundle size, memoization, waterfalls |
| `nextjs-patterns` | App Router, SSR boundaries, env vars, dynamic imports |
| `motion-ui` | Animations, transitions, spring physics |
| `accessibility` | WCAG, ARIA, keyboard nav, focus management |
| `prisma-patterns` | Schema, migrations, multi-tenant queries, soft deletes |
| `api-design` | REST conventions, status codes, pagination, middleware |
| `tdd-workflow` | TDD cycle, RBAC/tenant test patterns |
| `e2e-testing` | Playwright, Page Object Model, flaky test prevention |
| `git-workflow` | Branches, commits, PR descriptions |
| `docker-patterns` | Dockerfiles, docker-compose, container security |
| `ui-ux-pro-max` | Design system search, color/typography/motion database |

### Hooks (automatic triggers)

| Hook | Trigger | Action |
|---|---|---|
| `activate-on-task` | preTaskExecution | Phase 0 context scan + severity classification |
| `code-review-on-write` | postToolUse: write | SaaS safety + LeadCRM rule violations check |
| `quality-gate` | userTriggered | Full 7-gate quality check |
| `security-check-on-create` | fileCreated in auth/api/middleware/store | Security scan |
| `session-wrap` | agentStop | Capture new lessons learned |
