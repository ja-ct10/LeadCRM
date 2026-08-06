---
description: Skill and sub-agent routing matrix for LeadCRM. Always loaded.
inclusion: always
---

# LeadCRM — Skill Routing

## Auto-Activate Skills by Task Type

| Task / Keywords | Skills to Activate |
|---|---|
| Folder structure, module boundaries, FSD, feature slices, public API, index.ts | `workflow-process` → `understand-first` → `frontend-patterns` |
| Any UI: component, page, layout, modal, form, table, colors, spacing | `leadcrm-design-system` → `frontend-patterns` |
| Component structure, filters, charts, RBAC guards, dark mode | `frontend-patterns` |
| Animations, transitions, motion, spring, enter/exit | `motion-ui` |
| App Router, routing, dynamic imports, SSR boundary, env vars | `nextjs-patterns` |
| React hooks, useEffect, useState, component composition | `react-patterns` |
| Performance, re-renders, bundle size, memoization, waterfalls | `react-performance` |
| Accessibility, WCAG, aria, keyboard nav, focus, contrast | `accessibility` |
| Express route, controller, service, repository, middleware, Zod DTO | `backend-patterns` |
| Prisma, schema, migration, query, transaction, soft delete | `prisma-patterns` |
| REST API, endpoint design, status codes, pagination, versioning | `api-design` |
| Multi-tenancy, plan limits, feature gating, subscription, billing | `saas-scalability` |
| Auth, RBAC, JWT, sessions, tenant isolation, input validation | `security-review` |
| CRM logic, deal pipeline, contact scoring, workflow engine, campaigns | `crm-patterns` |
| Testing, Vitest, unit tests, coverage, TDD | `tdd-workflow` |
| Playwright, E2E tests, page objects, flaky tests | `e2e-testing` |
| PR, quality check, build, Definition of Done, pre-commit | `verification-loop` |
| Architecture decision, complex planning, severity assessment | `workflow-process` |
| Git, branches, commits, PR description | `git-workflow` |
| Docker, Dockerfile, docker-compose, containers | `docker-patterns` |
| UI/UX design system, color palettes, typography, design tokens | `ui-ux-pro-max` |
| Before ANY edit — understanding purpose, consumers, contracts, side effects | `understand-first` |

## Sub-Agent Routing

| Situation | Sub-Agent |
|---|---|
| Unfamiliar area, bug across files, understanding component interactions | `context-gatherer` (once at start) |
| Well-defined subtask, parallel work, large file rewrites | `general-task-execution` |
| Creating a new custom agent | `custom-agent-creator` |

## Context7 — Use for Current Framework APIs

Prefer Context7 over training knowledge for APIs that may have changed:
- Next.js 15 App Router
- React 19 (useActionState, use(), etc.)
- Prisma 5 query API
- motion/react v12
- Tailwind CSS v4

## Manual Steering — Load with `#` in Chat

| File | When to Load |
|---|---|
| `#lessons-learned` | Debugging, reviewing past decisions, recalling pitfalls |
| `#deployment` | Docker, CI, infrastructure, migration work |
