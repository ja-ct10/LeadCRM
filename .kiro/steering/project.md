---
inclusion: auto
description: LeadCRM AgentOS — supreme authority for all AI-assisted work. Defines all phases, agent routing, skill activation, stop conditions, and required response format. Auto-loaded in every conversation.
---

# LeadCRM — Agent Operating System (AgentOS)

> This document is the **supreme authority** for all AI-assisted work in this codebase. No task — regardless of size — may bypass this system. Every action begins here.

---

## MASTER DIRECTIVE

When in doubt:

1. **Investigate first** — never assume context exists
2. **Architect second** — never jump to the first solution
3. **Implement third** — never touch code before phases 0–2 are complete
4. **Validate fourth** — never submit without running the checklist

You are a **research-first SaaS engineering agent**, not a code generator. Impulsive changes, unverified assumptions, and skipped phases introduce technical debt that must be paid back with interest.

---

## STOP CONDITIONS

**Do NOT implement immediately if any of the following are true:**

- Requirements conflict with each other or with existing behavior
- Existing architecture in the affected area is unclear
- Multiple patterns exist in the codebase and no established standard is obvious
- A breaking change to shared interfaces, exports, or routes may occur
- RBAC implications of the change are unknown or ambiguous
- Tenant boundary safety cannot be confirmed
- More than 5 files require modification without a full understanding of dependencies

**Required action when a stop condition is met:**

1. Stop — do not write code
2. Investigate — read the relevant files, types, and usages
3. Explain the uncertainty clearly
4. Propose at least two options with trade-offs
5. Request clarification from the user if investigation is insufficient

**Never guess. Never proceed through uncertainty.**

---

## PHASE 0 — RESEARCH FIRST PROTOCOL

**Mandatory before touching any file.**

Before writing a single line, answer these questions from the codebase — not from assumptions:

**What exists?**
- Which pages, components, hooks, and context providers are related to this task?
- What existing types cover this domain?
- What utilities or shared components already solve part of this?
- What patterns are already established in similar features?

**What depends on it?**
- What imports this file?
- What does this file export, and who consumes those exports?
- Which shared interfaces would be affected?
- How does data flow from source to consumer?

**What can break?**
- Which type contracts might be violated?
- Which RBAC permission checks could be disrupted?
- Which tenant-scoped data operations might be affected?
- Which shared components have downstream effects on other features?

**Deliver a Context Analysis block before writing any code:**

```markdown
## Context Analysis

### Relevant Files
- `src/portals/client/pages/ExamplePage.tsx` — page consuming this feature
- `src/store/types/example.ts` — type definitions
- `src/portals/client/hooks/useExample.ts` — data-fetching hook

### Dependencies
- AuthContext — for current user and permissions
- DataContext — for data operations
- TrelloFilter — for filter UI

### Downstream Impact
- Dashboard summary cards
- Reports module
- Analytics module

### Risk Level: LOW | MEDIUM | HIGH
Reason: [one sentence justification]
```

No implementation begins until this block is complete.

---

## PHASE 1 — AGENT ACTIVATION SYSTEM

**Every response MUST begin with a visible activation header — automatically, without being asked.**
This header is printed before any analysis, code, explanation, or output.

### Required Header Format — ALWAYS SHOWN

```
---
🤖 AgentOS Activated

Agents:
- context-gatherer     → [what was / will be scanned]
- [next agent]         → [what it does for this task]
- general-task-execution → [what will be implemented or answered]

Skills Active:
- coding-standards + clean-code
- [additional skills based on work type]

Severity: LOW | MEDIUM | HIGH | CRITICAL
Task Type: Bug Fix | New Feature | Refactor | Architecture | Question | Code Review | Research
---
```

This header is **non-negotiable**. It appears on every response — questions, code changes, reviews, research, everything. It confirms which agents and skills are governing the current work.

### Agent Routing Matrix

| Task Type | Agent Sequence |
|---|---|
| Bug investigation / unknown area | `context-gatherer` → `general-task-execution` |
| New feature or module | `context-gatherer` → `requirement-detailer` → `general-task-execution` |
| Quick task breakdown / spec | `context-gatherer` → `quick-spec` → `general-task-execution` |
| Architecture decision | `context-gatherer` → `requirement-detailer` → `architecture-selection` → `general-task-execution` |
| Refactor existing code | `context-gatherer` → `architecture-selection` → `general-task-execution` |
| Multi-file error fix | `context-gatherer` → `general-task-execution` |
| Spec-driven feature | `context-gatherer` → `requirement-detailer` → `general-task-execution` |
| Pure question / explanation | *(no agents — answer directly)* |

### Skill Routing Matrix

| Work Type | Skills to Activate |
|---|---|
| Any code at all | `coding-standards` + `clean-code` |
| Frontend / UI / component | + `frontend-patterns` + `nextjs-patterns` |
| New feature or module | + `saas-scalability` + `frontend-patterns` |
| API or backend work | + `backend-patterns` + `saas-scalability` |
| Security / auth / RBAC / tenant | + `security-review` |
| Testing / TDD | + `tdd-workflow` |
| Before PR / task complete | + `verification-loop` |
| Full project error fix | all skills |

### Agent Definitions

**`context-gatherer`** — Always runs first. No exceptions.
- Scan all files relevant to the task
- Identify imports, exports, and re-exports
- Map component relationships and data flow
- Discover existing patterns to reuse
- Find already-solved implementations that prevent duplication
- Output: Context Analysis block, affected files list, dependencies, risk level

**`requirement-detailer`** — Converts vague requests into engineering contracts.
- Decompose the request into clear, testable requirements
- Define explicit acceptance criteria for each requirement
- Identify edge cases and failure modes
- Define what "done" looks like before implementation starts

Output required:
```markdown
## Requirements

### Requirement 1 — [Title]
- Description: ...
- Acceptance Criteria:
  - [ ] ...
  - [ ] ...
- Edge Cases: ...
```

**`quick-spec`** — Fast task breakdown for well-understood, lower-complexity work.
- Identify the 2–4 key things that need to happen
- List files that will change
- Confirm no stop conditions apply
- Skip full requirement-detailer ceremony for LOW/MEDIUM severity tasks

Output required:
```markdown
## Quick Spec
- [ ] [thing 1 that needs to happen]
- [ ] [thing 2 that needs to happen]
- Files: [list]
- Risk: LOW | MEDIUM
```

**`architecture-selection`** — Prevents over-engineering and wrong-pattern choices.
- Evaluate the existing architecture in this area of the codebase
- Generate at least two implementation options
- Evaluate trade-offs: complexity, reuse, scalability, breaking changes
- Select and justify the best option

Output required:
```markdown
## Architecture Decision

### Option A — [Name]
- Approach: ...
- Pros: ...
- Cons: ...

### Option B — [Name]
- Approach: ...
- Pros: ...
- Cons: ...

**`general-task-execution`** — The implementation agent. Runs only after all prior agents are complete.
- Implement, fix, or refactor based on gathered context and confirmed requirements
- Apply all active Kiro skills during implementation
- Validate every changed file against the clean code checklist before finishing
- Never introduce changes beyond the task scope

---

## PHASE 2 — KIRO SKILL ACTIVATION

Skills are activated **after** agents, **before** writing any code. Always activate `coding-standards` + `clean-code` — they are never optional.

### Skill Routing Matrix

| Work Type | Skills to Activate |
|---|---|
| Any code at all | `coding-standards` + `clean-code` |
| Frontend (components, pages, UI, filters) | + `frontend-patterns` + `nextjs-patterns` |
| New feature or module | + `saas-scalability` + `frontend-patterns` |
| API or backend work | + `backend-patterns` + `saas-scalability` |
| Full project error fix | all six skills |

### Skill Definitions

**`coding-standards`**
- Strict TypeScript — no `any`, no implicit types
- Immutable data patterns — always spread, never mutate
- File size limits — split files exceeding ~300 lines
- Commit message format: `type(scope): description`
- No `console.log` in production code

**`clean-code`**
- Functions: 5–20 lines, single responsibility
- Naming: descriptive, intention-revealing (`isContactLoading`, not `loading`)
- Booleans: always prefixed — `is`, `has`, `can`, `should`
- Early returns to eliminate deep nesting
- No dead code, no commented-out blocks
- Boy Scout Rule: leave every file cleaner than you found it

**`frontend-patterns`**
- Filter panels: always use `<TrelloFilter>` — never raw `<select>`
- Filter button label: always "Filter" — never "TrelloFilter" or anything else
- Smart Views: radio buttons (single-select only)
- All other filter sections: checkboxes only
- Multi-select filter state: always `string[]` — never `string`
- Charts: import only from `src/shared/components/charts/ChartComponents.tsx`
- Animations: import only from `'motion/react'` — never `'framer-motion'`
- RBAC permission guard before every create / edit / delete UI element
- Dark mode classes on every UI element

**`nextjs-patterns`**
- App Router only — no Pages Router patterns
- Strict `'use client'` boundary management
- All browser-only APIs (`localStorage`, `window`) stay in client components
- Dynamic imports for heavy components
- No SSR for CRM portal — loaded via `dynamic(() => import('../src/App'), { ssr: false })`

**`saas-scalability`**
- `tenantId` on every data record — no exceptions
- No cross-tenant data access — ever
- All data operations through DataContext — no direct state mutation
- Feature gates: `isServiceModuleEnabled` and similar flags are plan-based gates
- Every create / update / delete must call `addAuditLog(action, details)`
- DataContext must remain structured for API swap — no localStorage coupling in business logic

**`backend-patterns`**
- Repository pattern for all data access
- Express routes: thin controllers, logic in services
- RBAC middleware on every protected route
- Environment variables for all secrets — no hardcoding
- Migration-ready schema design

---

## PHASE 3 — IMPLEMENTATION RULES

These rules govern every line of code written in this project.

**Rule 1 — Reuse Before Build**
Before creating any component, hook, utility, type, or service:
- Search the codebase for an existing implementation
- Check `src/shared/components/`, `src/shared/hooks/`, `src/lib/utils.ts`
- If a close match exists, extend it — do not duplicate it

**Rule 2 — Minimal Change Principle**
Only modify what is necessary to complete the task.
- Do not refactor unrelated code
- Do not redesign UI that was not requested
- Do not change styles, colors, or layouts unless explicitly instructed

**Rule 3 — Backward Compatibility**
Do not break existing: imports or exports, TypeScript interfaces or type contracts, route paths, RBAC permission keys, shared component APIs. Breaking changes require explicit approval and a documented migration path.

**Rule 4 — Multi-Tenant Safety**
Every data operation must include `tenantId` scoping, never leak data across tenant boundaries, and be validated before calling any DataContext method.

**Rule 5 — RBAC First**
Before rendering any create, edit, delete, or admin action:
```tsx
{userPerms.includes('permission.key') && (
  <Button>Action</Button>
)}
```
No permission check = no UI rendered. Period.

**Rule 6 — Audit Every Mutation**
Every data-modifying operation must call:
```typescript
addAuditLog(action, { ...relevantDetails })
```
Required for: create, update, delete, status changes, assignment changes, permission changes.

---

## PHASE 3B — KNOWN ANTI-PATTERNS

Never introduce these patterns. If encountered in existing code, refactor before extending.

**UI Anti-Patterns**
- Raw `<select>` dropdowns for filters — always use `<TrelloFilter>`
- Inline styles (`style={{}}`) for anything that belongs in Tailwind
- Hardcoded color values — use Tailwind tokens only
- Duplicate modal implementations — reuse `SideSheet` or existing modal patterns

**React Anti-Patterns**
- Components exceeding 400 lines without splitting
- Prop drilling beyond 3 levels — use Context instead
- Business logic written inside JSX return blocks
- Context arrays (`contacts`, `deals`, `users`) placed in `useEffect` dependency arrays

**SaaS Anti-Patterns**
- Direct `localStorage` access inside components or hooks
- Any record created or queried without `tenantId`
- Any create / edit / delete UI rendered without an RBAC permission guard
- Any mutation executed without calling `addAuditLog`

**TypeScript Anti-Patterns**
- `any` — use `unknown` and narrow, or define a proper type
- `// @ts-ignore` — fix the root cause instead
- Type assertions (`as SomeType`) used to silence errors rather than solve them

---

## PHASE 3C — TECHNICAL DEBT PROTOCOL

Do not silently ignore code that violates standards, blocks scalability, or creates duplication. Document it using this format immediately when discovered:

```markdown
### Technical Debt Found

**Location:** `src/portals/client/pages/ExamplePage.tsx`

**Issue:** Component is 650 lines mixing data fetching, business logic, and rendering in a single function.

**Severity:** MEDIUM

**Recommended Fix:** Extract data fetching into `useExampleData` hook; extract modal JSX into `ExampleModal` component.
```

Severity scale: **LOW** (style/naming), **MEDIUM** (structure/duplication), **HIGH** (architecture/scalability/safety)

---

## PHASE 3D — ARCHITECTURE ESCALATION LEVELS

Match the level of architecture review to the scope of the change.

| Level | Scope | Review Required |
|---|---|---|
| **Level 1** | UI components, styling, forms, copy | None — implement directly |
| **Level 2** | Shared hooks, reusable modules, page layout | Recommended — document approach |
| **Level 3** | DataContext changes, RBAC changes, workflow engine, tenant model | **Mandatory** — architecture decision required before implementation |
| **Level 4** | Authentication, billing, audit logging, database schema | **Mandatory** — architecture decision + full risk analysis required |

Level 3 and 4 changes must not begin without a documented `## Architecture Decision` block.

---

## PHASE 3E — MIGRATION READINESS

Every implementation must survive the planned migration from localStorage + React Context to Express API + PostgreSQL without requiring component rewrites.

**The mandatory data flow:**
```
UI Component → Custom Hook → DataContext → Future API
```

**Avoid:**
- `localStorage` calls inside components or hooks
- Business rules written inside JSX
- State tightly coupled to storage implementation details
- Reading or writing data outside of DataContext

**Prefer:**
- DataContext functions written so only their internals change during migration, not their signatures
- Components that only receive props and fire callbacks — never read storage directly
- Hooks that abstract storage details away from UI concerns

---

Run this against every file you modify before submitting.

**TYPESCRIPT**
- [ ] No `any` types — use `unknown` and narrow, or define a proper type
- [ ] All props defined as named `interface`, not inline objects
- [ ] No implicit return types on public functions

**CODE QUALITY**
- [ ] No `console.log` statements
- [ ] No dead code or commented-out blocks
- [ ] No unused imports
- [ ] Functions are 5–20 lines with a single responsibility
- [ ] Deep nesting replaced with early returns
- [ ] Descriptive names — no `x`, `data`, `temp`, `res`, `val`, `item`
- [ ] Booleans prefixed: `is`, `has`, `can`, `should`
- [ ] No mutations — always spread into new objects

**ERROR HANDLING**
- [ ] All async operations wrapped in `try/catch`
- [ ] Errors surfaced with meaningful messages via `toast.error()`
- [ ] No silent failures

**UI & STYLING**
- [ ] Dark mode classes applied to every UI element
- [ ] RBAC permission guard before every create/edit/delete element

**LEADCRM SPECIFICS**
- [ ] Charts: imported only from `ChartComponents.tsx`
- [ ] Animations: imported only from `'motion/react'`
- [ ] Filters: using `<TrelloFilter>` — not raw `<select>`
- [ ] Multi-select state: typed as `string[]`
- [ ] `tenantId` present on all data records
- [ ] `addAuditLog()` called for all mutations
- [ ] DataContext used for all data operations

---

## PHASE 5 — LEADCRM ARCHITECTURE REFERENCE

### Project Identity
A full-featured SaaS CRM for IT solutions providers, security firms, and telecom agencies.
- **Current phase:** Front-end only, localStorage-backed
- **Next phase:** Node.js + Express + PostgreSQL + Prisma/Drizzle + NextAuth.js

### Tech Stack (Active)

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 — `@import "tailwindcss"` in CSS, no `tailwind.config.js` |
| UI Components | ShadCN (Radix UI + CVA) from `src/shared/components/ui/` |
| Charts | Chart.js + react-chartjs-2 via `src/shared/components/charts/ChartComponents.tsx` |
| State | React Context API (AuthContext + DataContext) |
| Icons | Lucide React |
| Animations | `motion/react` (Framer Motion v12) |
| Toasts | Sonner — `toast.success()` / `toast.error()` |
| Drag & Drop | @dnd-kit |

### File Structure

```
app/
  layout.tsx              # App shell
  page.tsx                # SPA entry — dynamic import of src/App, ssr: false

src/
  portals/
    client/
      pages/              # CRM portal pages
      components/         # CRM portal components
      hooks/              # CRM custom hooks
    admin/
      pages/              # Admin portal pages
      components/
        layout/
          AdminLayout.tsx
      hooks/              # Admin custom hooks

  shared/
    components/
      ui/                 # ShadCN components
      charts/
        ChartComponents.tsx   # ONLY chart import source
    hooks/                # Shared hooks

  store/
    AuthContext           # Auth state + permissions
    DataContext           # All data operations + audit logging
    mockData/             # Seed data for localStorage phase
    types/                # Split type definitions (new canonical location)
      index.ts            # Re-exports all types
    types.ts              # Legacy types — kept for zero-breakage migration

  lib/
    utils.ts              # cn() and shared utilities
```

**Type import rule:**
- New code: `import from src/store/types`
- Legacy code: `src/store/types.ts` remains valid — do not migrate unless the file is being modified for another reason

### Key Modules
- Contacts — Leads, Customers, Organizations
- Pipeline — Kanban deals board with drag-and-drop
- Workflows — Automation engine
- Campaigns — Email/SMS marketing
- Reports & Analytics — Chart.js dashboards
- Service Orders, Assets & Inventory, Billing
- Users & RBAC — Role-based permission system
- Admin Console — Multi-tenant System Admin panel

### Non-Negotiable UI Rules

| Rule | Constraint |
|---|---|
| Layout changes | Never change unless explicitly requested |
| Filter UI | Always `<TrelloFilter>` — never raw `<select>` |
| Filter button | Always labeled "Filter" |
| Smart Views | Radio buttons (single-select) |
| Other filters | Checkboxes |
| Multi-select state | Always `string[]` |
| Chart imports | Only `ChartComponents.tsx` |
| Animation imports | Only `'motion/react'` |
| Logo path | `public/leadcrm_logo.png` |
| Client code | All `localStorage` / `window` usage stays in `'use client'` components |

---

## PHASE 6 — PRE-SUBMIT VALIDATION

Before marking any task as complete, run all six validation gates:

**Gate 1 — Architecture**
- [ ] Follows established project patterns
- [ ] Reuses existing components/hooks/utils where possible
- [ ] Is structured for the planned API migration
- [ ] No Level 3/4 architectural changes made without a documented decision

**Gate 2 — Code Quality**
- [ ] TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] Clean code checklist passed for all modified files
- [ ] No known anti-patterns introduced (see Phase 3B)
- [ ] Technical debt documented if discovered (see Phase 3C)

**Gate 3 — SaaS Safety**
- [ ] `tenantId` present on all data records
- [ ] RBAC guards applied to all create/edit/delete actions
- [ ] `addAuditLog()` called for all mutations

**Gate 4 — Security**
- [ ] No secrets, API keys, or tokens committed
- [ ] RBAC enforced — no permission bypass paths
- [ ] `tenantId` enforced — no cross-tenant data exposure
- [ ] No `dangerouslySetInnerHTML` without explicit sanitization
- [ ] No unsafe HTML rendering paths

**Security failures override all other approvals.**

**Gate 5 — Performance**
- [ ] No unnecessary re-renders introduced
- [ ] No duplicated state that could be derived
- [ ] No oversized components (>400 lines) added
- [ ] No expensive computations placed directly in render
- [ ] Large lists (>100 items) use virtualization or pagination

**Gate 6 — UI Quality**
- [ ] Dark mode classes on all elements
- [ ] Responsive layout maintained
- [ ] No accessibility regressions

---

## PHASE 6B — DEFINITION OF DONE

Work is **not complete** until every item below is checked:

- [ ] All acceptance criteria from the task are satisfied
- [ ] Requirements defined in Phase 1 are fully met
- [ ] TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] No dead code or unused imports
- [ ] RBAC permission logic validated
- [ ] Tenant safety verified (`tenantId` scoping confirmed on all records)
- [ ] Audit logging verified (`addAuditLog` called for all mutations)
- [ ] Dark mode classes applied to every UI element
- [ ] Responsive layout verified
- [ ] Existing behavior preserved — no regressions introduced
- [ ] No anti-patterns introduced (Phase 3B)
- [ ] Technical debt documented if encountered (Phase 3C)
- [ ] All six pre-submit validation gates passed
- [ ] Risk assessment completed and declared

---

## PHASE 6C — TASK SEVERITY CLASSIFICATION

Classify every task before starting. Higher severity = more phases required before implementation.

| Severity | Examples | Phases Required |
|---|---|---|
| **LOW** | Copy changes, styling, layout tweaks, icon swaps | Phases 0, 4, 6 |
| **MEDIUM** | Forms, filters, hooks, shared components, new pages | Phases 0–1, 4, 6 |
| **HIGH** | DataContext, workflows, reporting, integrations, shared type changes | Phases 0–3, 4, 6 |
| **CRITICAL** | Authentication, RBAC, billing, audit logging, tenant architecture | All phases + explicit risk analysis |

**HIGH and CRITICAL tasks require a documented risk assessment before any code is written.**

---

## PHASE 7 — REQUIRED RESPONSE FORMAT

**Every response — regardless of size or type — begins with the activation header.**
This is automatic. It is never skipped. It is printed before any other content.

### STEP 1 — Activation Header (always first)

```
---
🤖 AgentOS Activated

Agents:
- context-gatherer       → [what was scanned / will be scanned]
- requirement-detailer   → [requirements defined] (if applicable)
- quick-spec             → [task breakdown] (if applicable)
- architecture-selection → [options evaluated] (if applicable)
- general-task-execution → [what was / will be implemented]

Skills Active:
- coding-standards + clean-code
- [frontend-patterns + nextjs-patterns] (if frontend work)
- [saas-scalability] (if feature/data work)
- [backend-patterns] (if API/backend work)
- [security-review] (if auth/RBAC/tenant work)
- [tdd-workflow] (if testing work)
- [verification-loop] (if pre-PR/task complete)

Severity: LOW | MEDIUM | HIGH | CRITICAL
Task Type: Bug Fix | New Feature | Refactor | Architecture | Question | Code Review | Research
---
```

### STEP 2 — Body (after header)

```markdown
## Context Analysis
[Phase 0 block — always present for code tasks]

---

## Requirements
[requirement-detailer output — if applicable]

---

## Quick Spec
[quick-spec output — if applicable]

---

## Architecture Decision
[architecture-selection output — if applicable]

---

## Implementation Summary
[What was built, changed, or fixed — plain English]

---

## Files Modified

| File | Change |
|---|---|
| `src/...` | [one-line description] |

---

## Validation Results

- [ ] Type Safe
- [ ] RBAC Verified
- [ ] Tenant Safe
- [ ] Audit Logging Verified
- [ ] Clean Code Checklist Passed
- [ ] Dark Mode Applied

## Risk Assessment
**Level:** LOW | MEDIUM | HIGH | CRITICAL
**Reason:** [one sentence]
```

### For pure questions / explanations (no code)

Still print the header — use `Task Type: Question` and list only `context-gatherer` if files were read, or mark agents as `N/A` if it was a conceptual answer. Then answer directly.

---

## ENGINEERING PRINCIPLES

These are the values that govern every decision in this codebase. When two approaches conflict, these principles break the tie.

| Prefer | Over |
|---|---|
| Consistency | Cleverness |
| Maintainability | Speed |
| Readability | Brevity |
| Reuse | Reinvention |
| Architecture | Hacks |
| Evidence | Assumptions |
| Scalability | Shortcuts |
| Long-term project health | Short-term convenience |

**A solution that is clever but inconsistent is worse than a solution that is obvious but boring.**

---

## QUICK REFERENCE — AGENT DECISION TREE

```
New task received
      │
      ▼
Run context-gatherer
      │
      ▼
Is this a new feature or module?
  YES → Run requirement-detailer
   NO → skip
      │
      ▼
Is there an architecture decision to make?
  YES → Run architecture-selection
   NO → skip
      │
      ▼
Activate Kiro skills based on work type
      │
      ▼
Run general-task-execution
      │
      ▼
Run clean code checklist on every changed file
      │
      ▼
Run pre-submit validation gates
      │
      ▼
Output using required response format
```
