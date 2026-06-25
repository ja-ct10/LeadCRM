# LeadCRM — Kiro AI Configuration Guide

Everything in this folder controls how Kiro behaves on this project. Most of it runs automatically — you never need to activate it manually.

---

## Folder Structure

```
.kiro/
├── steering/       ← Always-on rules (compact enforcement, loaded every session)
├── skills/         ← Deep knowledge files (activated on-demand by work type)
├── power/          ← Portable package (import into new projects)
├── hooks/          ← Automatic triggers (fire on IDE events)
├── MASTER-AUDIT.md         ← Full architecture audit + prioritised recommendations
├── IMPLEMENTATION-PLAN.md  ← 6-phase build plan with task status
├── ReadMe-Kiro.md           ← This file
└── Own-Command-Notes.md     ← Developer quick reference (not loaded by agents)
```

---

## 1. STEERING — Always-On Enforcement

**Location:** `.kiro/steering/`

Loaded automatically into every conversation. These are **compact enforcement rules**, not deep references. For full examples and patterns, activate the corresponding skill.

| File | Loads | Purpose |
|---|---|---|
| `project-core.md` | Always | Tech stack, file structure, non-negotiable rules (TrelloFilter, animations, charts, RBAC, audit). The single authoritative reference. |
| `security.md` | Always | RBAC enforcement, tenant isolation, secret management, security protocol. |
| `lessons-learned.md` | Always | Project-specific patterns, known pitfalls, accumulated knowledge. Updated as you build. |
| `clean-code-rules.md` | Always | Naming, function size limits, pre-commit checklist. Compact. See `skills/clean-code.md` for depth. |
| `typescript-context.md` | When editing `.ts`/`.tsx` | TypeScript + React rules injected inline while editing code files. |
| `project.md` | Manual (`#project`) | Supreme authority — AgentOS phases, agent routing, stop conditions, response format. |
| `standards.md` | Manual (`#standards`) | SOLID principles, TypeScript rules, naming, React patterns, pre-commit checklist. See `skills/coding-standards.md` for depth. |
| `workflow.md` | Manual (`#workflow`) | Task lifecycle, 5-role team review, branch strategy, commit format. |
| `testing.md` | Manual (`#testing`) | Coverage minimums, required test scenarios, critical RBAC/tenant/audit patterns. See `skills/tdd-workflow.md` for depth. |
| `modes.md` | Manual (`#dev-mode` etc.) | Four focused work modes — dev, review, research, performance. |

**Design principle:** Steering files are concise. They tell you *what* the rule is. Skills tell you *why* and *how* with full examples.

---

## 2. SKILLS — Deep Knowledge Files

**Location:** `.kiro/skills/`

Activated when specific work begins. Contain full patterns, code examples, and checklists. Go deeper than steering files.

| Skill | Activated For | Covers |
|---|---|---|
| `coding-standards.md` | All code | SOLID, TypeScript strictness, naming, immutability, React patterns, commit format |
| `clean-code.md` | All code | Function design, DRY, readability, error handling, file size limits, Boy Scout Rule |
| `frontend-patterns.md` | UI / components | TrelloFilter rules, form patterns, dark mode, RBAC guards, animation imports, loading states |
| `nextjs-patterns.md` | Next.js files | App Router boundaries, SSR rules, dynamic imports, env vars, Tailwind v4 |
| `saas-scalability.md` | Features / data ops | Multi-tenancy, plan gating, domain events, audit logging, migration readiness |
| `backend-patterns.md` | API / backend | Layer architecture, repository pattern, auth, RBAC middleware, Zod validation |
| `security-review.md` | Security-sensitive work | Full security checklist, RBAC patterns, tenant-safe queries, input validation |
| `tdd-workflow.md` | Tests / new features | TDD cycle, test naming, coverage requirements, AAA pattern, critical test scenarios |
| `verification-loop.md` | Before PR / task complete | 7-gate verification: TypeScript → quality → build → SaaS → security → UI → regression |

### Skill Routing (applied automatically via steering + hooks)

| Work Type | Skills |
|---|---|
| Any code | `coding-standards` + `clean-code` |
| Frontend / UI | + `frontend-patterns` + `nextjs-patterns` |
| New feature | + `saas-scalability` + `frontend-patterns` |
| API / backend | + `backend-patterns` + `saas-scalability` |
| Security / auth / RBAC | + `security-review` |
| Tests / TDD | + `tdd-workflow` |
| Before PR | `verification-loop` |

### Steering vs Skills — The Design Decision

The two layers are intentionally separate:

| Layer | Size | Loaded | Purpose |
|---|---|---|---|
| Steering | Compact (< 80 lines) | Auto, always | Enforce the rule inline during every task |
| Skill | Deep (200–400 lines) | On-demand | Explain why, show patterns, provide checklists |

`clean-code-rules.md` (steering) tells you *no functions over 40 lines*. `clean-code.md` (skill) shows you how to refactor a 80-line function into focused units with real examples.

---

## 3. POWER — Portable Package

**Location:** `.kiro/power/`

The Power packages the AgentOS so you can import it into any new project with one click.

```
power/
├── POWER.md              ← Power manifest (name, keywords, description)
└── steering/
    ├── project.md        ← Full AgentOS (always loaded when power is active)
    ├── quick-reference.md ← Decision tree + severity table (#quick-reference)
    ├── anti-patterns.md   ← Never-do list (#anti-patterns)
    └── validation-gates.md ← All 6 gates + DoD checklist (#validation-gates)
```

**To import into a new project:**
1. Open Kiro Powers panel
2. Click Add Custom Power → Import from folder
3. Point it at `.kiro/power/`

---

## 4. HOOKS — Automatic Triggers

**Location:** `.kiro/hooks/`

Fire automatically on IDE events — no command needed.

| Hook | Triggers When | What It Does |
|---|---|---|
| `activate-on-task.kiro.hook` | Before any spec task starts | Prints activation header, Phase 0 context scan, severity classification |
| `code-review-on-write.kiro.hook` | After any file write | Quick security + quality scan on written code |
| `security-check-on-create.kiro.hook` | New file in `auth/`, `api/`, `middleware/`, `store/` | Security audit on sensitive new files |
| `quality-gate.kiro.hook` | Manual trigger | Full 5-gate quality check before committing |
| `session-wrap.kiro.hook` | Session ends | 2–3 sentence summary + suggests `lessons-learned.md` entries |

---

## 5. DOCS Reference

All engineering documentation lives in `docs/`. Key files:

| Doc | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | System overview, dual-portal design, tech stack, key rules |
| `docs/STRUCTURE.md` | Complete folder map — authoritative source for project layout |
| `docs/PORTAL-SEPARATION.md` | Why two portals, physical separation, routing |
| `docs/API.md` | Backend API endpoint reference |
| `docs/database/erd.md` | Entity relationships, Prisma model map |
| `docs/security/permission-matrix.md` | Role × module access matrix |
| `docs/security/audit-log-strategy.md` | What gets logged and how |
| `docs/workflows/` | Customer lifecycle, lead-to-deal, pipeline flow, task assignment |
| `docs/setup/local-dev.md` | Local development setup |
| `docs/setup/environment-variables.md` | All environment variables |

---

## 6. Quick Reference — Never-Do List

| ❌ Never | ✅ Always |
|---|---|
| Raw `<select>` for filters | `<TrelloFilter>` |
| `string` for multi-select state | `string[]` |
| `framer-motion` imports | `motion/react` |
| Direct recharts imports | `ChartComponents.tsx` only |
| `any` type | `unknown` + narrow |
| `localStorage` in components | DataContext |
| Mutation without `addAuditLog` | `addAuditLog()` on every mutation |
| Record without `tenantId` | `tenantId: tenant.id` always |
| Create/edit/delete without RBAC | Permission check first |
| `deal.contactId` (singular) | `deal.contactIds` (array) |
| `git add .` | Stage specific files only |
| Commit to `main` directly | Always via `dev-copy-1` → PR |
