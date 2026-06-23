# LeadCRM — Kiro AI Configuration Guide

This folder contains everything that controls how Kiro (and any AI agent) behaves when working on this project. You never need to activate most of this manually — it runs automatically.

---

## Folder Structure

```
.kiro/
├── hooks/          ← Automatic triggers (run on events without being asked)
├── skills/         ← Deep knowledge files (activated by name when needed)
├── steering/       ← Always-on rules (loaded into every conversation)
├── power/          ← Portable package (import this into other projects)
└── README.md       ← This file
```

---

## 1. STEERING — Always-On Rules

**Location:** `.kiro/steering/`

Steering files are instructions that Kiro reads automatically. Think of them as your team's engineering handbook — always open on the desk.

### Files and What They Do

| File | Loads | Purpose |
|---|---|---|
| `project.md` | Always | **Supreme authority.** AgentOS phases, agent routing, stop conditions, response format. Everything starts here. |
| `standards.md` | Always | SOLID principles, TypeScript rules, naming conventions, design patterns, pre-commit checklist. |
| `workflow.md` | Always | Task lifecycle, 5-role team review, branch strategy, commit format, Definition of Done. |
| `security.md` | Always | Threat model, RBAC enforcement, tenant isolation, secret management, security protocol. |
| `testing.md` | Always | TDD workflow, coverage requirements, critical test cases (RBAC, tenant, audit). |
| `lessons-learned.md` | Always | Project-specific patterns, known pitfalls, accumulated team knowledge. Updated as you build. |
| `typescript-context.md` | When editing `.ts`/`.tsx` | TypeScript + React rules injected inline while you edit code files. |
| `modes.md` | On demand | Four work modes loaded by tag (see below). |

### On-Demand Modes (`modes.md`)

Type these tags in chat to load focused context:

| Tag | When to Use |
|---|---|
| `#dev-mode` | Starting implementation — loads pre-impl checklist and LeadCRM reminders |
| `#review-mode` | Reviewing a PR or diff — loads all 5-role review checklists |
| `#research-mode` | Evaluating options or making architecture decisions |
| `#performance` | Model selection, context window tips, build troubleshooting |

**Example:**
```
#review-mode

Review the changes I made to ContactsPage.tsx
```

---

## 2. HOOKS — Automatic Triggers

**Location:** `.kiro/hooks/`

Hooks fire automatically when events happen — no command needed. They enforce quality without interrupting your flow.

### Hook Reference

| Hook File | Triggers When | What It Does |
|---|---|---|
| `activate-on-prompt.kiro.hook` | Every chat message | Silently routes to correct skills based on work type |
| `activate-on-task.kiro.hook` | Before any spec task starts | Runs Phase 0 research, classifies severity, activates skills |
| `typecheck-on-edit.kiro.hook` | `.ts`/`.tsx` file saved | Scans for type errors, `any` usage, missing return types |
| `auto-format.kiro.hook` | `.ts`/`.tsx`/`.js` file saved | Fixes formatting issues (indentation, import order) |
| `console-log-check.kiro.hook` | `.ts`/`.tsx`/`.js` file saved | Removes `console.log` — replaces with `toast` where needed |
| `code-review-on-write.kiro.hook` | After any file write | Quick security + quality scan on written code |
| `tdd-reminder.kiro.hook` | New `.ts`/`.tsx` file created | Reminds to write the failing test before implementing |
| `security-check-on-create.kiro.hook` | New file in `auth/`, `api/`, `store/` | Security audit on sensitive new files |
| `quality-gate.kiro.hook` | Manual trigger | Full 5-gate quality check before committing |
| `session-summary.kiro.hook` | Session ends | 2–3 sentence summary of what was done |
| `extract-patterns.kiro.hook` | Session ends | Suggests new entries for `lessons-learned.md` |

### How to Trigger the Quality Gate Manually

Open the Kiro Agent Hooks panel and click the **Quality Gate** hook, or ask:
```
Run the quality gate
```

---

## 3. SKILLS — Deep Knowledge Files

**Location:** `.kiro/skills/`

Skills are detailed reference documents activated when specific types of work begin. They go deeper than steering files — full patterns, examples, checklists.

### Skill Reference

| Skill File | Activated For | Contains |
|---|---|---|
| `coding-standards.md` | All code | TypeScript strictness, naming, immutability, React standards, commit format |
| `clean-code.md` | All code | SOLID, naming, functions, error handling, DRY, Boy Scout Rule |
| `frontend-patterns.md` | UI / components | TrelloFilter rules, form patterns, dark mode, RBAC guards, animation imports |
| `nextjs-patterns.md` | Next.js files | App Router rules, SSR boundary, dynamic imports, env vars, Tailwind v4 |
| `saas-scalability.md` | Features / data ops | Multi-tenancy, plan gating, domain events, audit logging, migration readiness |
| `backend-patterns.md` | API / backend | Layer architecture, repository pattern, auth, RBAC middleware, Zod validation |
| `security-review.md` | Security-sensitive work | Full security checklist, RBAC patterns, tenant-safe queries, input validation |
| `tdd-workflow.md` | Tests / new features | TDD cycle, test naming, coverage requirements, critical scenarios |
| `verification-loop.md` | Before PR / task complete | 7-gate verification: TypeScript → quality → build → SaaS → security → UI → regression |

### Skill Routing (automatic via hooks)

```
Any code                → coding-standards + clean-code
Frontend/UI work        → + frontend-patterns + nextjs-patterns
New feature             → + saas-scalability + frontend-patterns
API/backend             → + backend-patterns + saas-scalability
Security/auth/RBAC      → + security-review
Tests/TDD               → + tdd-workflow
Before PR               → verification-loop
```

---

## 4. POWER — Portable Package

**Location:** `.kiro/power/`

The Power packages everything above so you can import it into a new project with one click.

```
power/
├── POWER.md              ← Power manifest (name, keywords, description)
└── steering/
    ├── project.md        ← Full AgentOS (always loaded)
    ├── quick-reference.md ← Decision tree + severity table (#quick-reference)
    ├── anti-patterns.md   ← Never-do list (#anti-patterns)
    └── validation-gates.md ← All 6 gates + DoD checklist (#validation-gates)
```

### How to Import Into a New Project

1. Open Kiro **Powers panel**
2. Click **Add Custom Power → Import from folder**
3. Point it at `.kiro/power/`

---

## 5. ACTIVATION HEADER — What You'll See Automatically

**Every single response** starts with this header. You never ask for it — it just appears.

```
---
🤖 AgentOS Activated

Agents:
- context-gatherer       → scanned ContactsPage.tsx, useContactFilters, TrelloFilter
- requirement-detailer   → defined 2 requirements with acceptance criteria
- general-task-execution → implementing country filter with TrelloFilter + string[] state

Skills Active:
- coding-standards + clean-code
- frontend-patterns + nextjs-patterns
- saas-scalability

Severity: MEDIUM
Task Type: New Feature
---
```

This tells you exactly what the agent knows, what rules it's following, and what it's about to do — before it does anything.

### What Each Part Means

| Part | Meaning |
|---|---|
| **Agents** | Which sub-agents are running and what each one is doing for this specific task |
| **Skills Active** | Which rule sets are enforced during this work |
| **Severity** | How risky this task is — determines how many phases are required |
| **Task Type** | Category of work — affects agent routing |

### Agent Descriptions

| Agent | When It Runs | What It Does |
|---|---|---|
| `context-gatherer` | Always, first | Reads existing files, finds patterns, maps dependencies |
| `requirement-detailer` | New features | Breaks request into testable requirements with acceptance criteria |
| `quick-spec` | Simple/medium tasks | Fast 2–4 point task breakdown, skips full ceremony |
| `architecture-selection` | Complex/HIGH tasks | Evaluates ≥2 options, documents trade-offs, picks best approach |
| `general-task-execution` | Always, last | Writes the actual code/answer after all prior agents complete |

---

## 6. REAL SCENARIOS

### Scenario A — You ask Kiro to "add a filter to the Contacts page"

**What happens automatically:**
1. `activate-on-prompt` hook fires → detects frontend work → activates `frontend-patterns` + `nextjs-patterns` + `coding-standards` + `clean-code`
2. Kiro runs **Phase 0** — reads `ContactsPage.tsx`, finds existing filter pattern, checks `TrelloFilter` usage
3. Classifies as **MEDIUM** severity
4. Implements using `<TrelloFilter>`, `string[]` state, `useMemo` for filtered list, dark mode classes
5. `code-review-on-write` hook fires after writing → scans for missing RBAC guard, tenantId, audit log
6. `typecheck-on-edit` hook fires → verifies no `any`, correct return types
7. Session ends → `session-summary` and `extract-patterns` hooks fire

**You never typed "activate skills" once.**

---

### Scenario B — You create a new file `src/core/auth/useSession.ts`

**What happens automatically:**
1. `tdd-reminder` hook fires → "Have you written the failing test for this file yet?"
2. `security-check-on-create` hook fires → scans for hardcoded secrets, missing RBAC, missing tenantId
3. `typescript-context.md` steering is injected → TypeScript rules are active while you edit

---

### Scenario C — You ask Kiro to "redesign the pipeline board"

**What happens automatically:**
1. `activate-on-prompt` fires → detects frontend + potential architecture work
2. Kiro classifies as **HIGH** severity (DataContext + drag-and-drop + shared types)
3. Stop condition triggered: "More than 5 files require modification" → Kiro stops, produces Context Analysis block, proposes ≥2 architecture options, asks for your choice before writing a line
4. After you choose → full implementation with all skills active

---

### Scenario D — You manually run the Quality Gate

Click the Quality Gate hook or type "run the quality gate":

```
Gate 1 — TypeScript:  PASS — zero type errors
Gate 2 — Code Quality: PASS — no console.log, no unused imports
Gate 3 — SaaS Safety:  PASS — tenantId present, addAuditLog called
Gate 4 — Security:     FAIL — ContactCard renders delete button without RBAC guard
Gate 5 — UI Quality:   PASS — dark mode classes on all elements
```

Kiro then fixes Gate 4 and re-confirms.

---

## 7. QUICK REFERENCE

### How Inclusion Works

| Front Matter | Behaviour |
|---|---|
| `inclusion: auto` | Loaded in **every** conversation automatically |
| `inclusion: fileMatch` + `fileMatchPattern` | Loaded when a matching file is open in the editor |
| `inclusion: manual` | Only loaded when you type its `#tag` in chat |
| *(no front matter)* | Same as `auto` — loads always |

### The 5-Role Team Model

Every task is reviewed through 5 lenses:

| Role | Checks |
|---|---|
| Developer | Clean code, SOLID, error handling |
| Tech Lead | Patterns, reuse, migration-readiness |
| QA Engineer | All 6 test scenarios, UI states, regression |
| Security Engineer | RBAC, tenantId, secrets, audit logs |
| Product Owner | Acceptance criteria, UX, dark mode, responsiveness |

### Never-Do Shortcuts

| ❌ Never | ✅ Always |
|---|---|
| Raw `<select>` for filters | `<TrelloFilter>` |
| `string` for multi-select state | `string[]` |
| `framer-motion` imports | `motion/react` |
| Direct recharts imports | `ChartComponents.tsx` |
| `any` type | `unknown` + narrow |
| `localStorage` in components | DataContext |
| Mutation without `addAuditLog` | Call `addAuditLog()` first |
| Record without `tenantId` | `tenantId: tenant.id` always |
| Create/edit/delete without RBAC | `canCreate && <Button>` |
