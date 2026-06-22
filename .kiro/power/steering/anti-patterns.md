---
inclusion: manual
---

# LeadCRM AgentOS — Anti-Patterns Reference

Use `#anti-patterns` in chat to load this into context.

Never introduce any pattern listed here. If found in existing code, document as Technical Debt before extending.

---

## UI Anti-Patterns

| ❌ Never | ✅ Always |
|---|---|
| Raw `<select>` for filters | `<TrelloFilter>` component |
| `style={{}}` inline styles | Tailwind classes |
| Hardcoded color values | Tailwind tokens |
| Duplicate modal implementations | Reuse `SideSheet` or existing modals |
| Filter label other than "Filter" | Label exactly "Filter" |
| `framer-motion` imports | `motion/react` only |
| Direct chart library imports | `ChartComponents.tsx` only |

---

## React Anti-Patterns

| ❌ Never | ✅ Always |
|---|---|
| Components > 400 lines | Split into sub-components |
| Prop drilling > 3 levels | Use Context |
| Business logic in JSX return | Extract to functions or hooks |
| Context arrays in `useEffect` deps | Remove arrays from dependency arrays |
| `useEffect` for derived state | Compute inline or with `useMemo` |

---

## SaaS Anti-Patterns

| ❌ Never | ✅ Always |
|---|---|
| `localStorage` in components/hooks | DataContext only |
| Records without `tenantId` | `tenantId` on every record |
| Create/edit/delete without RBAC guard | `userPerms.includes('key')` check first |
| Mutations without `addAuditLog` | Call `addAuditLog` on every mutation |
| Cross-tenant data access | Scope all queries by `tenantId` |
| Business logic in localStorage reads | Abstract through DataContext |

---

## TypeScript Anti-Patterns

| ❌ Never | ✅ Always |
|---|---|
| `any` type | `unknown` + narrowing, or proper type |
| `// @ts-ignore` | Fix the root cause |
| `as SomeType` to silence errors | Solve the actual type mismatch |
| Inline object types for props | Named `interface` |
| Implicit return types on public functions | Explicit return types |

---

## Technical Debt Format

When you find an anti-pattern in existing code, document it before extending:

```markdown
### Technical Debt Found

**Location:** `src/portals/client/pages/ExamplePage.tsx`
**Issue:** [what the problem is]
**Severity:** LOW | MEDIUM | HIGH
**Recommended Fix:** [specific action to take]
```

Severity: **LOW** = style/naming · **MEDIUM** = structure/duplication · **HIGH** = architecture/safety
