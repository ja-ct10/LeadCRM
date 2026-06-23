---
inclusion: auto
description: Clean Code rules enforced on every file in LeadCRM. Auto-loaded every session.
---

# Clean Code Rules — LeadCRM

> Applied to every file. No exceptions.

## 1. Meaningful Naming
- Use clear, descriptive names: `userCount` not `x`, `filteredContacts` not `data`
- Booleans: `isOpen`, `hasError`, `canEdit`, `shouldRefetch`
- Functions: verb phrases — `getFilteredDeals()`, `handleContactSave()`
- Event handlers: `handle` prefix — `handleSubmit`, `handleFilterChange`

## 2. Small Functions — One Responsibility
- One function = one job
- Ideal: 5–20 lines. Review at 20–40. **Refactor required at 40+**
- If a function needs a comment to explain what it does → extract it

## 3. Avoid Code Duplication — DRY
- Same logic more than twice → extract to shared util, hook, or service
- Never copy-paste JSX blocks → extract to a named component

## 4. Readable, Self-Documenting Code
- Code explains itself — no comments for *what*, only *why*
- Named constants over magic values:
  ```typescript
  // BAD
  if (contacts.length > 250) warn();
  // GOOD
  const FREE_PLAN_LIMIT = 250;
  if (contacts.length > FREE_PLAN_LIMIT) warn();
  ```

## 5. Proper Structure
- 2-space indentation (enforced)
- React component order: hooks → derived values → handlers → JSX
- One blank line between logical groups

## 6. Avoid Deep Nesting — Early Returns
```typescript
// BAD
if (user) { if (tenant) { if (perm) { doWork(); } } }

// GOOD
if (!user) return;
if (!tenant) return;
if (!perm) return;
doWork();
```

## 7. File Size Limits
| Type | Target | Hard Limit |
|---|---|---|
| Component | 250 lines | 400 lines |
| Page | 500 lines | 800 lines |
| Hook | 100 lines | 150 lines |
| Service | 100 lines | 200 lines |
| Util | 80 lines | 150 lines |

Files over the hard limit **must be split** before adding new features.

## 8. Error Handling
- Never ignore errors silently: `catch (e) {}` is forbidden
- Always show meaningful messages: `toast.error('Failed to save contact')`
- Wrap all async ops in `try/catch`

## 9. Single Responsibility
- One file = one purpose
- Never mix: UI rendering + business logic + data fetching in the same component
- Split into: Page (orchestrator) → Hook (logic) → Component (render)

## 10. Refactor Regularly
- Delete unused imports, variables, dead code on every touch
- Boy Scout Rule: leave every file cleaner than you found it
- If renaming — rename everywhere (use semantic rename tools)

## Quick Checklist Before Every Commit
- [ ] No `any` types
- [ ] No `console.log`
- [ ] No functions over 40 lines
- [ ] No files over hard limit without split
- [ ] No magic numbers/strings
- [ ] No deep nesting (early returns used)
- [ ] No silent `catch` blocks
- [ ] No unused imports
- [ ] No copy-pasted JSX (extracted to component)
