---
inclusion: auto
description: Clean Code enforcement rules for LeadCRM — auto-loaded every session. See skills/clean-code.md for full patterns and examples.
---

# Clean Code — LeadCRM Enforcement Rules

> Applied to every file, every session. For full patterns and examples, activate `clean-code` skill.

## Hard Rules (no exceptions)

| Rule | Requirement |
|---|---|
| Function length | ≤ 40 lines. Refactor at 40+, no argument. |
| Single responsibility | One function = one job. "and" in the name = split it. |
| Naming | Descriptive: `filteredContacts` not `data`, `isFormOpen` not `flag` |
| Booleans | Always prefixed: `is`, `has`, `can`, `should` |
| Nesting | Max 3 levels. Use early returns to flatten. |
| Error handling | `catch (e) {}` is forbidden. Always `toast.error()` with a meaningful message. |
| Dead code | Delete unused imports, variables, and functions on every touch. |
| Magic values | Named constants always: `FREE_PLAN_LIMIT = 250` not `250` |
| Duplication | Same logic twice → extract. Same JSX twice → extract to component. |

## Component Architecture Order

```
1. Imports
2. Named interface for props (never inline)
3. Hooks (all useState/useRef/useMemo/useEffect)
4. Derived values
5. Event handlers (handle prefix)
6. Return JSX
```

## File Size Limits

| File Type | Hard Limit |
|---|---|
| React Component | 400 lines → split |
| React Page | 800 lines → split |
| Custom Hook | 150 lines → split |
| Utility/Service | 200 lines → split |

Files over the hard limit **must be split before adding new features.**

## Pre-Commit Checklist

- [ ] No `any` types
- [ ] No `console.log`
- [ ] No functions over 40 lines
- [ ] No function with "and" in the name (multiple responsibilities)
- [ ] No files over hard limit without split
- [ ] No magic numbers or strings — named constants used
- [ ] No deep nesting — early returns used
- [ ] No silent `catch` blocks
- [ ] No unused imports or dead code
- [ ] No copy-pasted JSX — extracted to named component
