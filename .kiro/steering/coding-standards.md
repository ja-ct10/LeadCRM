# LeadCRM — Coding Standards

## TypeScript Rules

- `any` forbidden — use `unknown` + narrowing
- `@ts-ignore` forbidden
- `as Type` only to widen, never to silence errors
- Explicit return types on all exported functions
- Named `interface` for all component props — never inline
- Catch: `error instanceof Error ? error.message : 'Unexpected error'`
- Boolean prefixes: `is`, `has`, `can`, `should`
- Constants: `UPPER_SNAKE_CASE`
- Forbidden names: `x`, `data`, `val`, `res`, `temp`, `item`, `obj`, `cb`

## React Rules

- All hooks at top level — never inside conditions, loops, or callbacks
- `useEffect` deps: stable scalar IDs only — **NEVER** Context arrays
- Derived state: `useMemo` or inline — never duplicate with `useState`
- Keys: stable `id` — never array index
- Mutations: always spread new objects — never mutate
- `useRef` for Context arrays in effects to avoid infinite re-render loops

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

## UI Rules

- Dark mode classes on **every** element — no light-only components
- RBAC guard on every create/edit/delete element — no guard = no render
- `cn()` for conditional classes — never string concatenation
- No inline `style={{}}` — Tailwind classes only
- Never change layout/design unless explicitly asked
- Detail views: drawers/sheets for quick-view + full pages (`/crm/{entity}/[id]`) for deep CRUD (see ADR-001)

## Import Organization

```typescript
// 1. External packages
import { useState, useMemo } from 'react';
import { z } from 'zod';

// 2. Internal shared (absolute @/ imports)
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';

// 3. Feature-local (relative imports)
import { useContacts } from '../hooks/use-contacts';
import type { Contact } from '../types/contact.types';
```

## Error Handling

- Backend services: `AppError(message, statusCode)` — never plain `new Error()`
- Frontend catch: always log + notify user (toast) — never silent
- Network failures: retry up to 3× with exponential backoff for idempotent ops
- Validation errors: return field-level details — never generic messages

## API Client Rules

- Always `credentials: 'include'` for HttpOnly cookie auth
- Never use `Authorization: Bearer` with custom JWT cookies
- Response handling: 401 → redirect to login, 403/404 → handle gracefully

## Database Query Safety

- Every query includes `tenantId` filter — enforced at repository layer
- Pagination: max 100 per page, default 25 — never unbounded results
- Transactions for multi-record mutations: `prisma.$transaction([...])`

## Anti-Patterns (NEVER)

- Raw `<select>` for filters (use TrelloFilter)
- Inline `style={{}}` or hardcoded hex colors
- Components over 400 lines
- Prop drilling > 3 levels (extract context or hook)
- Logic in JSX return bodies
- Context arrays in `useEffect` deps (infinite loop)
- Direct `localStorage` in components for business data
- Records without `tenantId`
- RBAC-unguarded create/edit/delete UI
- `any` type or `@ts-ignore`
- `console.log` in production
- Silent catch blocks
- Duplicate type definitions
- `framer-motion` imports (use `motion/react`)
- Direct `chart.js` imports (use `ChartComponents.tsx`)

## STOP CONDITIONS

Do NOT write code if:
- Requirements conflict with existing behavior
- Architecture is unclear
- Breaking change to shared interfaces without dependency map
- RBAC implications unknown
- Tenant boundary safety unconfirmable
- More than 5 files need changes without a plan

→ Stop · Investigate · Propose options before proceeding.
