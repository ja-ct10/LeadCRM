# LeadCRM AgentOS Power

A research-first SaaS engineering agent operating system for building production-grade CRM applications with Next.js, TypeScript, React Context, and multi-tenant SaaS architecture.

## What This Power Does

This Power enforces a disciplined, phased engineering workflow on every task — no skipping phases, no guessing, no impulsive code changes. It turns Kiro into a structured engineering partner that:

- **Researches before coding** — always reads existing code before writing new code
- **Classifies task severity** — LOW / MEDIUM / HIGH / CRITICAL, each requiring different levels of rigor
- **Routes to the right agents** — context-gatherer → requirement-detailer → architecture-selection → general-task-execution
- **Enforces SaaS safety rules** — tenantId on every record, RBAC guards on every action, audit logging on every mutation
- **Validates before submitting** — 6 pre-submit gates: Architecture, Code Quality, SaaS Safety, Security, Performance, UI Quality

## Keywords

saas, crm, nextjs, typescript, react, multi-tenant, rbac, agentos, engineering, research-first, clean-code, frontend, backend, audit, tenant, leadcrm

## When to Use

Activate this Power when working on any SaaS CRM project built with:
- Next.js 15 (App Router)
- TypeScript + React Context
- Multi-tenant architecture with RBAC
- localStorage → API migration pattern

## Steering Files Included

| File | Purpose | Inclusion |
|---|---|---|
| `project.md` | Full AgentOS — all phases, rules, checklists | Always (auto-loaded) |
| `quick-reference.md` | Agent decision tree + severity table at a glance | Manual (`#quick-reference`) |
| `anti-patterns.md` | Known bad patterns to never introduce | Manual (`#anti-patterns`) |
| `validation-gates.md` | All 6 pre-submit gates + Definition of Done | Manual (`#validation-gates`) |

## Core Phases

| Phase | Name | Purpose |
|---|---|---|
| Phase 0 | Research First | Context Analysis before any code |
| Phase 1 | Agent Activation | Declare which agents and skills are active |
| Phase 2 | Skill Activation | Route to correct skills by work type |
| Phase 3 | Implementation Rules | 6 rules + anti-patterns + debt protocol |
| Phase 4 | Clean Code Checklist | Per-file validation before submitting |
| Phase 5 | Architecture Reference | Tech stack, file structure, UI rules |
| Phase 6 | Pre-Submit Validation | 6 gates + Definition of Done |
| Phase 7 | Response Format | Structured output format for every task |

## Agent Routing Matrix

| Task Type | Agent Sequence |
|---|---|
| Bug investigation | context-gatherer → general-task-execution |
| New feature | context-gatherer → requirement-detailer → general-task-execution |
| Architecture decision | context-gatherer → requirement-detailer → architecture-selection → general-task-execution |
| Refactor | context-gatherer → architecture-selection → general-task-execution |

## Skill Routing Matrix

| Work Type | Skills |
|---|---|
| Any code | coding-standards + clean-code |
| Frontend | + frontend-patterns + nextjs-patterns |
| New feature | + saas-scalability + frontend-patterns |
| API / backend | + backend-patterns + saas-scalability |
| Full error fix | All six skills |
