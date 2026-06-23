---
inclusion: manual
description: On-demand context modes for LeadCRM — Development, Review, Research, and Performance. Load with #dev-mode, #review-mode, #research-mode, or #performance.
---

# Context Modes — LeadCRM

Load a specific mode by typing its tag in chat:
- `#dev-mode` — active feature implementation
- `#review-mode` — code review and quality assessment
- `#research-mode` — technology evaluation and architecture decisions
- `#performance` — model selection, token management, build troubleshooting

---

## #dev-mode — Development Mode

Use when actively implementing a feature, fixing a bug, or writing code.

### Pre-Implementation Checklist

Before writing a single line:
- [ ] Requirements fully understood — no ambiguity remaining
- [ ] Existing code scanned — no duplication about to be introduced
- [ ] Task severity classified: LOW | MEDIUM | HIGH | CRITICAL
- [ ] For HIGH/CRITICAL: architecture decision documented before proceeding
- [ ] Stop conditions checked — none of them apply

### Implementation Mindset

**Think like a team, not a solo developer:**

| Ask yourself | Why it matters |
|---|---|
| Would the Tech Lead approve this pattern? | Consistency and reuse |
| Would QA find a gap in this? | Coverage and edge cases |
| Would the Security Engineer flag this? | RBAC, tenant, secrets |
| Would the Product Owner accept this UX? | Acceptance criteria |

### Development Workflow

```
1. Read the requirement — understand it completely
2. Scan related files — find existing patterns to reuse
3. Plan the change — identify every file that needs modification
4. Write failing tests first (TDD) — describe expected behavior
5. Implement minimum working solution
6. Refactor for clarity — apply SOLID, clean code, naming rules
7. Verify all tests pass
8. Run pre-commit checklist
9. Report: what changed, risk level, what was tested
```

### Code Quality Focus

- **SRP first** — if a function or component does two things, split it
- **DRY always** — search `src/shared/`, `src/lib/`, existing hooks before creating anything new
- **Immutable always** — spread into new objects, never mutate
- **Types always** — no `any`, named interfaces for all props, explicit return types
- **Dark mode always** — every UI element needs both light and dark classes

### LeadCRM-Specific Reminders

```typescript
// Every record created needs these three things:
const newRecord = {
  id:        uuid(),
  tenantId:  tenant.id,           // from AuthContext — never from user input
  createdAt: new Date().toISOString(),
  ...data,
};

// Every mutation needs audit logging:
addAuditLog('entity.action', { entityId: newRecord.id, ...relevantDetails });

// Every create/edit/delete UI needs a permission guard:
const canCreate = isAdmin || userPerms.includes('module.create');
{canCreate && <Button>New Item</Button>}
```

---

## #review-mode — Code Review Mode

Use when conducting a code review, self-reviewing a PR diff, or assessing quality of existing code.

### Review Process

```
1. Read the PR description — understand intent before reading code
2. Check git diff scope — identify all changed files
3. Read each changed file in context — not in isolation
4. Apply all five role checklists (Developer, Tech Lead, QA, Security, Product)
5. Classify and report findings by severity
```

### Review Checklist — All Five Roles

**Developer**
- [ ] Code is readable without comments explaining *what* it does
- [ ] No duplication — DRY applied throughout
- [ ] Functions focused — single responsibility
- [ ] Error handling comprehensive — no silent failures
- [ ] Edge cases handled: null, undefined, empty array, zero

**Tech Lead**
- [ ] Follows existing project patterns — no new patterns without justification
- [ ] Reuses existing components, hooks, and utilities
- [ ] Migration-ready: data flows through DataContext, not directly to storage
- [ ] No breaking changes to shared interfaces without documented migration path
- [ ] File sizes within limits — no oversized components or hooks
- [ ] SOLID principles applied

**QA Engineer**
- [ ] Happy path works
- [ ] Invalid input rejected with clear message
- [ ] Empty, loading, error states handled
- [ ] RBAC: blocked without permission, allowed with permission or as Admin
- [ ] Tenant: data scoped correctly
- [ ] Regressions: existing tests still pass

**Security Engineer**
- [ ] No hardcoded secrets
- [ ] RBAC enforced on every mutating action
- [ ] `tenantId` on all records and queries
- [ ] Input validated before processing
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] Error messages expose no internals
- [ ] `addAuditLog()` called for all mutations

**Product Owner**
- [ ] All acceptance criteria satisfied
- [ ] UI correct in light and dark mode
- [ ] Responsive at mobile and desktop widths
- [ ] No regressions in adjacent features

### Severity Classification

| Severity | Examples | Action Required |
|---|---|---|
| **CRITICAL** | Auth bypass, cross-tenant leak, exposed secret, RBAC bypass | Block merge — fix immediately |
| **HIGH** | Missing audit log, unvalidated API input, silent error, broken permission | Block merge — fix before review approval |
| **MEDIUM** | Component too large, missing test, prop drilling, duplicate logic | Fix before merge or create tracked debt item |
| **LOW** | Naming inconsistency, style deviation, minor improvement | Fix in same PR if trivial, or track |

### Reporting Format

```markdown
## Code Review — [PR Title]

### CRITICAL (block merge)
- [ ] [file:line] [description of issue]

### HIGH (fix before approval)
- [ ] [file:line] [description of issue]

### MEDIUM (fix or track)
- [ ] [file:line] [description of issue]

### LOW (optional)
- [ ] [file:line] [description of issue]

### Approved ✅ / Changes Requested 🔄
[One sentence summary of overall quality]
```

---

## #research-mode — Research and Architecture Mode

Use when evaluating technology options, making architecture decisions, or comparing implementation approaches.

### Research Process

```
1. Define the problem precisely — what decision needs to be made?
2. Identify evaluation criteria — what matters for LeadCRM specifically?
3. Research at least two options — never evaluate a single option
4. Score each option against criteria
5. Document trade-offs honestly — no cherry-picking
6. Make a recommendation with clear justification
7. Identify risks and mitigation
```

### Evaluation Criteria for LeadCRM

Score each option against these criteria (1–5):

| Criterion | Why it matters |
|---|---|
| **Migration safety** | Can it survive the localStorage → PostgreSQL migration? |
| **TypeScript compatibility** | Full type safety, no `any` escape hatches? |
| **Bundle size impact** | Does it bloat the client-side bundle? |
| **Multi-tenant safety** | Does it support tenant isolation without workarounds? |
| **Testability** | Can it be unit tested without complex mocking? |
| **Maintenance burden** | Is it actively maintained? Docs quality? Community size? |
| **Consistency** | Does it fit the existing patterns in this codebase? |
| **Breaking change risk** | Would adopting it require changing existing code? |

### Architecture Decision Output Format

```markdown
## Architecture Decision — [Decision Title]

### Context
What problem are we solving? Why does this require a documented decision?

### Option A — [Name]
- Approach: [how it works]
- Pros: [strengths]
- Cons: [weaknesses]
- Migration impact: [effect on localStorage → API migration]
- Score: [1–5 per criterion]

### Option B — [Name]
- Approach: [how it works]
- Pros: [strengths]
- Cons: [weaknesses]
- Migration impact: [effect on localStorage → API migration]
- Score: [1–5 per criterion]

### Selected: Option [X]
Reason: [one clear paragraph — why this option wins for LeadCRM specifically]

### Risk Level: LOW | MEDIUM | HIGH | CRITICAL
Mitigation: [how the risk is managed going forward]

### Reversibility
[How hard would it be to undo this decision? What would reversal cost?]
```

### Research Quality Rules

- Always evaluate **at least two options** — a single-option "decision" is not a decision
- Score options honestly — acknowledge the cons of the selected option
- Consider the **current phase** (localStorage + React Context) AND the **next phase** (Express + PostgreSQL)
- Prefer **boring, proven technology** over exciting novelty — this is a production CRM
- Document the decision in `lessons-learned.md` after finalizing

---

## #performance — Performance and Model Management

Use when optimizing AI model usage, managing context windows, or troubleshooting build issues.

### Model Selection Strategy

Choose the right model for the task to balance cost and quality:

| Model | Best For | Cost |
|---|---|---|
| **Claude Haiku** | Lightweight tasks, frequent invocations, worker agents | Low |
| **Claude Sonnet** | Main development work, complex coding, orchestration | Medium |
| **Claude Opus** | Deep architectural reasoning, complex debugging, research | High |

**Default:** Sonnet for most LeadCRM work.
**Upgrade to Opus when:** designing multi-tenant architecture, planning the PostgreSQL migration, debugging complex context/state interactions.
**Downgrade to Haiku when:** simple formatting, documentation generation, repetitive transforms.

### Context Window Management

**Never start complex work in the last 20% of the context window:**

| Task Type | Context Sensitivity |
|---|---|
| Large-scale refactoring | HIGH — start fresh |
| Multi-file feature implementation | HIGH — start fresh |
| Complex bug spanning multiple files | HIGH — start fresh |
| Single-file edit | LOW — safe anywhere |
| Documentation update | LOW — safe anywhere |
| Simple bug fix | LOW — safe anywhere |

**Compact at logical breakpoints — never mid-implementation:**

| When to `/compact` | When NOT to `/compact` |
|---|---|
| After research phase, before implementation | Mid-implementation (lose variable names, partial state) |
| After completing a feature milestone | Mid-debugging (lose the error context) |
| After a failed approach, before trying a new one | During multi-step refactor |
| After a large review session | |

### Extended Thinking

For complex reasoning tasks, extended thinking reserves tokens for internal deliberation:
- Architecture decisions
- Security threat modeling
- Multi-file refactoring planning
- Debugging non-obvious issues

Use structured output (numbered steps, decision trees) alongside extended thinking for best results.

### Build Troubleshooting

If `npm run build` fails:

```
1. Read the full error — do not skim
2. Identify the first error (not the last — cascading errors follow the root cause)
3. Fix one error at a time — do not batch fix
4. Run `npx tsc --noEmit` for type errors in isolation
5. Run `npx eslint src/ --max-warnings 0` for lint errors in isolation
6. Re-run build after each fix to confirm resolution
7. If stuck: search the error message + "Next.js 15" or "Tailwind v4"
```

**Common LeadCRM build issues:**

| Error | Cause | Fix |
|---|---|---|
| `themeColor in metadata` warning | `viewport` not exported separately | Export `viewport` as its own const in `layout.tsx` |
| `framer-motion not found` | Wrong import path | Change to `import from 'motion/react'` |
| `Cannot find module 'recharts'` | Direct recharts import | Import from `ChartComponents.tsx` only |
| `Type 'any' is not assignable` | Missing type narrowing | Use `unknown` + `instanceof Error` pattern |
| Tailwind classes not applying | Missing `@import "tailwindcss"` | Add to top of `src/index.css` |
