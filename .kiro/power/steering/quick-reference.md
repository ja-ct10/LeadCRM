---
inclusion: manual
---

# LeadCRM AgentOS — Quick Reference

Use `#quick-reference` in chat to load this into context.

---

## Agent Decision Tree

```
New task received
      │
      ▼
Run context-gatherer (ALWAYS FIRST)
      │
      ▼
Is this a new feature or module?
  YES → Run requirement-detailer
   NO → skip
      │
      ▼
Is there an architecture decision?
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

---

## Task Severity

| Severity | Examples | Phases Required |
|---|---|---|
| **LOW** | Copy, styling, layout tweaks, icon swaps | Phases 0, 4, 6 |
| **MEDIUM** | Forms, filters, hooks, new pages | Phases 0–1, 4, 6 |
| **HIGH** | DataContext, workflows, reporting, type changes | Phases 0–3, 4, 6 |
| **CRITICAL** | Auth, RBAC, billing, audit, tenant arch | All phases + risk analysis |

---

## Agent Routing

| Task | Agents |
|---|---|
| Bug / unknown area | context-gatherer → general-task-execution |
| New feature | context-gatherer → requirement-detailer → general-task-execution |
| Architecture decision | context-gatherer → requirement-detailer → architecture-selection → general-task-execution |
| Refactor | context-gatherer → architecture-selection → general-task-execution |
| Multi-file error fix | context-gatherer → general-task-execution |

---

## Skill Routing

| Work Type | Skills |
|---|---|
| Any code | `coding-standards` + `clean-code` |
| Frontend | + `frontend-patterns` + `nextjs-patterns` |
| New feature | + `saas-scalability` + `frontend-patterns` |
| API / backend | + `backend-patterns` + `saas-scalability` |
| Full error fix | All six |

---

## Stop Conditions — Do NOT code if:

- Requirements conflict with existing behavior
- Architecture in the affected area is unclear
- Multiple patterns exist, no established standard
- Breaking change to shared interfaces may occur
- RBAC implications are unknown
- Tenant boundary safety cannot be confirmed
- >5 files need changes without understanding dependencies

---

## Non-Negotiable UI Rules

| Rule | Value |
|---|---|
| Filter UI | Always `<TrelloFilter>` |
| Filter label | Always "Filter" |
| Smart Views | Radio buttons only |
| Other filters | Checkboxes only |
| Multi-select state | Always `string[]` |
| Charts | Only `ChartComponents.tsx` |
| Animations | Only `'motion/react'` |
| Dark mode | Every element, no exceptions |
| RBAC guard | Every create / edit / delete |
