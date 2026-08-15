---
description: Skill and sub-agent routing matrix. Load manually with #skill-routing when planning complex tasks.
inclusion: manual
---

# LeadCRM — Skill Routing

## Auto-Activate by Task Type

| Task | Skills |
|---|---|
| UI components, pages, modals, forms | `frontend-patterns` |
| Design tokens, colors, typography, spacing | `leadcrm-design-system` |
| Animations, transitions, motion | `motion-ui` |
| App Router, dynamic imports, middleware | `nextjs-patterns` |
| React hooks, useEffect, composition | `react-patterns` |
| Performance, re-renders, memoization | `react-performance` |
| Accessibility, WCAG, aria, keyboard | `accessibility` |
| Express routes, controllers, services | `backend-patterns` |
| Prisma schema, migrations, queries | `prisma-patterns` |
| REST API design, endpoints, pagination | `api-design` |
| Multi-tenancy, plan limits, feature flags | `saas-scalability` |
| Auth, RBAC, sessions, tenant isolation | `security-review` |
| CRM logic, deals, pipelines, workflows | `crm-patterns` |
| Testing, TDD, coverage | `tdd-workflow` |
| E2E testing, Playwright | `e2e-testing` |
| PR quality, build verification | `verification-loop` |
| Architecture decisions, planning | `workflow-process` |
| Git, branches, commits, PRs | `git-workflow` |
| Docker, containers, compose | `docker-patterns` |
| Before ANY edit | `understand-first` |

## Sub-Agent Routing

| Situation | Agent |
|---|---|
| Unfamiliar codebase area, cross-file bugs | `context-gatherer` (once at start) |
| Well-defined subtask, parallel work | `general-task-execution` |
| Creating new custom agent | `custom-agent-creator` |

## Context7 — Use for Current APIs

Prefer Context7 over training knowledge for:
- Next.js 15 App Router
- React 19
- Prisma 5
- motion/react v12
- Tailwind CSS v4

## Manual Steering (load with `#`)

| File | When |
|---|---|
| `#lessons-learned` | Debugging, reviewing past decisions |
| `#deployment` | Docker, CI, infrastructure |
| `#testing` | Writing tests |
| `#skill-routing` | Planning complex multi-skill tasks |
