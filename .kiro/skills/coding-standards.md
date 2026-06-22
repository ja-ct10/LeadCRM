---
name: coding-standards
description: TypeScript and React coding standards for LeadCRM — auto-applied to ALL code written in this project
---

# Coding Standards — LeadCRM

> Source: ECC rules/common + rules/typescript, adapted for this project.

## Immutability — CRITICAL
```typescript
// WRONG — mutates existing object
contact.status = 'Hot';

// CORRECT — returns new object
const updated = { ...contact, status: 'Hot' };
```
Never mutate state directly. Always spread into a new object.

## TypeScript Rules
- No `any` in application code — use `unknown` and narrow it
- All exported functions need explicit return types
- Component props defined as named `interface`, not inline
- Use `string` literal unions over `enum`:
```typescript
type ContactStatus = 'Hot' | 'Warm' | 'Cold' | 'Closed' | 'Cancelled';
```

## File Size Limits
- Components: max 400 lines — split if larger
- Pages: max 800 lines — extract sub-components
- Utils/helpers: max 200 lines per file

## Naming
- Components + Types + Interfaces: `PascalCase`
- Functions + variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Booleans: start with `is`, `has`, `can`, `should`
- Custom hooks: start with `use`

## Error Handling
```typescript
// ALWAYS wrap async in try/catch
try {
  const result = await someOperation();
  toast.success('Done!');
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  toast.error(msg);
}
```

## No Console Logs in Production Code
- Remove all `console.log` before committing
- Use toast notifications for user-facing messages
- Use proper error boundaries for React errors

## Input Validation
- Validate required fields before submit
- Show errors inline below the field
- Never trust external data — validate API responses

## KISS / DRY / YAGNI
- KISS: simplest solution that works
- DRY: extract repeated logic into shared utils/hooks
- YAGNI: don't build what's not needed yet

## Git Commit Format
```
feat: add contact status filter with checkboxes
fix: prevent infinite loop in ContactFormSheet useEffect
refactor: extract filter logic into useContactFilters hook
docs: update steering rules with RBAC pattern
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

## Code Quality Checklist (Before every commit)
- [ ] No `any` types
- [ ] No `console.log`
- [ ] No mutations — spread pattern used
- [ ] Props interface defined
- [ ] Error handling in place
- [ ] Dark mode classes on all UI elements
- [ ] Filter state uses `string[]` for multi-select
- [ ] No recharts imports — ChartComponents.tsx only
- [ ] RBAC permission check if feature modifies data
