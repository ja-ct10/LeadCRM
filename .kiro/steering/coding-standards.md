---
description: LeadCRM coding standards — TypeScript rules, React rules, SaaS safety, anti-patterns, file naming, size limits. Always loaded.
inclusion: always
---

# LeadCRM — Coding Standards

## TypeScript

- `any` forbidden — use `unknown` + narrowing
- `@ts-ignore` forbidden
- `as Type` only to widen, never to silence errors
- Explicit return types on all exported functions
- Named `interface` for all component props — never inline types
- Catch blocks: `error instanceof Error ? error.message : 'Unexpected error'`
- Boolean prefixes: `is`, `has`, `can`, `should`
- Constants: `UPPER_SNAKE_CASE`
- Forbidden names: `x`, `data`, `val`, `res`, `temp`, `item`, `obj`, `cb`

## React

- Component ≤ 400 lines | Page ≤ 800 | Hook ≤ 150 | Service ≤ 200 | Function ≤ 40 lines
- All hooks called at top level — never inside conditions, loops, or callbacks
- `useEffect` deps: stable scalar IDs only — **NEVER** Context arrays (`contacts`, `deals`, `users`, etc.)
- Derived state: `useMemo` or inline — never duplicate with `useState`
- Keys: stable `id` — never array index
- Mutations: always spread into new objects — never mutate

## SaaS Safety (Non-Negotiable)

- `tenantId: tenant.id` on every new record — sourced from `useAuth()`, **NEVER** from user input
- `tenant` from `useAuth()` — **NEVER** from `useData()`
- `addAuditLog()` on every create/update/delete — no exceptions
- `addActivity()` on every mutation creating an observable state change
- All data ops through `DataContext` only — never direct `localStorage` in components or hooks

## UI Rules

- Dark mode classes on **every** element — no light-only components
- RBAC guard on every create/edit/delete UI element — no guard = no render
- `cn()` for conditional classes — never string concatenation
- No inline `style={{}}` — Tailwind classes only
- Never change layout/design unless explicitly asked
<!-- animations/charts/filter constraints in product.md Key Constraints -->

## File Naming

- All files: `kebab-case.tsx` ✓ — `PascalCase.tsx` ✗
- Services: same name FE + BE (`contacts.service.ts`)

## Size Limits

| Type | Max Lines |
|---|---|
| React Component | 400 |
| React Page | 800 |
| Custom Hook | 150 |
| Frontend Service | 200 |
| Backend Controller | 100 |
| Backend Service | 200 |
| Backend Repository | 150 |
| Any Function | 40 |

## Anti-Patterns (NEVER)

- Raw `<select>` for filters
- Inline `style={{}}` or hardcoded hex colors
- Components over 400 lines
- Prop drilling > 3 levels (extract context or hook)
- Logic in JSX return bodies
- Context arrays in `useEffect` deps (infinite loop)
- Direct `localStorage` in components or hooks
- Records without `tenantId`
- Mutations without `addAuditLog()`
- RBAC-unguarded create/edit/delete UI
- `any` type or `@ts-ignore`
- `console.log` in production code
- Silent catch blocks
- Duplicate type definitions

## STOP CONDITIONS

Do NOT write code if any of these are true:
- Requirements conflict with existing behavior
- Architecture is unclear
- Breaking change to shared interfaces may occur
- RBAC implications unknown
- Tenant boundary safety unconfirmable
- More than 5 files need changes without a dependency map

→ Stop · Investigate · Propose options before proceeding.

<!-- Git rules removed — load #git-workflow skill when needed -->
