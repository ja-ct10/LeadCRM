---
name: understand-first
description: Understand before changing — read the goal, purpose, and dependencies of any function, component, or element before modifying it. Apply before every edit to prevent regressions, unintended side effects, and broken contracts.
---

# Understand First — LeadCRM

> Inspired by the community best practice: always know *what* something does and *why* it exists before changing it. Prevent regressions before they happen.

## The Rule

**Before touching any file, function, component, or element:**

1. **Read it fully** — not just the lines you plan to change
2. **Identify its purpose** — what does it do? What problem does it solve?
3. **Map its consumers** — who calls it? What depends on its output/shape?
4. **Check its contracts** — TypeScript interface, props, return type, side effects
5. **Then change** — with full awareness of impact

## Pre-Edit Checklist

Before any modification, answer these:

```
□ What is the PURPOSE of this function/component/element?
□ What would BREAK if this changes?
□ Who CALLS this? (imports, usages across the codebase)
□ What INTERFACE does it expose? (props, return type, events)
□ Does it have SIDE EFFECTS? (addAuditLog, addActivity, state mutations)
□ Is it SHARED? (used in more than one place)
□ Is there a RBAC or tenant-safety implication?
```

## When to Stop and Research First

Stop editing immediately if:
- You don't know what the function/component was originally built for
- The file is > 100 lines and you've only read the part you're changing
- It's in `store/`, `shared/`, `core/`, or `api/middleware/` (shared infrastructure)
- It has > 3 call sites across the codebase
- The TypeScript interface is used in > 1 module

Use `context-gatherer` sub-agent to map dependencies before proceeding.

## Practical Pattern

```typescript
// WRONG — change first, understand later
// Just update this line to fix the bug...
const result = contacts.filter(c => c.status === status);

// RIGHT — understand first
// Q: What does this filter do?
// A: Filters the contacts list by status for the table view
// Q: Who calls it?
// A: ContactsTable, ReportingPage, CampaignAudiencePreview (3 consumers)
// Q: Does changing the logic break any consumer?
// A: CampaignAudiencePreview expects ALL statuses when status is empty string
// → Now I know to guard: c.status === status || status === ''
```

## For UI Elements

Before changing any UI element (button, form field, badge, layout):

```
□ What is the USER PURPOSE of this element? (not just visual)
□ Is it tied to a permission guard? (canCreate, canEdit, canDelete)
□ Does it trigger a mutation? (check for addAuditLog requirement)
□ Is its style defined in the design system? (check ui-ux.md first)
□ Is it a shared component from src/shared/? (changes affect all uses)
```

## For Data Operations

Before changing any DataContext function, repository query, or service:

```
□ What BUSINESS RULE does this enforce?
□ Does it include tenantId? (mandatory on all queries)
□ Does it call addAuditLog()? (mandatory on all mutations)
□ What is the MIGRATION CONTRACT? (signature must stay compatible with future API)
□ Does changing it break any TypeScript interfaces in shared/?
```

## Context Analysis Output (required for HIGH/CRITICAL changes)

```markdown
## Context Analysis — [Function/Component Name]
**Purpose:** [what it does and why it exists]
**Call sites:** [list of files that import/use it]
**Interface:** [props, parameters, return type]
**Side effects:** [state mutations, audit logs, activities, notifications]
**Risk if changed:** LOW | MEDIUM | HIGH
**Safe to modify:** YES | NO — [reason if NO]
```
