---
description: All hard constraints — code quality, UI, React, SaaS safety, security, anti-patterns. Always loaded.
---

# LeadCRM — Rules

## STOP CONDITIONS
Do NOT write code if: requirements conflict with existing behavior · architecture is unclear · breaking change to shared interfaces may occur · RBAC implications unknown · tenant boundary safety unconfirmable · more than 5 files need changes without a dependency map. Stop → Investigate → Propose options.

## UI
- Filter UI: always `<TrelloFilter>` — never raw `<select>`. Button label = "Filter".
- Smart Views = radio (single string). All other filters = checkbox (`string[]`).
- Charts: only from `ChartComponents.tsx`. Animations: only from `motion/react`.
- Dark mode classes on every element. No inline styles. Logo: `public/leadcrm_logo.png`.
- RBAC guard on every create/edit/delete UI element — no guard = no render.
- Never change layout/design unless explicitly asked.

## React
- Component ≤ 400 lines. Page ≤ 800. Hook ≤ 150. Service ≤ 200. Function ≤ 40 lines.
- Props = named `interface` — never inline types.
- `useEffect` deps: stable scalar IDs only — NEVER Context arrays.
- Derived state: `useMemo` or inline — never duplicate with `useState`.
- Keys: stable `id` — never array index. Mutations: always spread into new objects.

## TypeScript
- `any` forbidden — use `unknown` + narrowing. `@ts-ignore` forbidden.
- `as Type` only to widen, never to silence errors.
- Explicit return types on all exported functions.
- Catch: `error instanceof Error ? error.message : 'Unexpected error'`
- Booleans prefixed: `is`, `has`, `can`, `should`. Constants: `UPPER_SNAKE_CASE`.
- No: `x`, `data`, `val`, `res`, `temp`, `item`, `obj`, `cb` as names.

## SaaS Safety
- Every record: `tenantId: tenant.id` (from `useAuth()` — NEVER user input).
- `tenant` comes from `useAuth()` — NEVER from `useData()`.
- `addAuditLog()` on every create/update/delete — no exceptions.
- `addActivity()` on every mutation creating an observable event.
- Data ops through DataContext only — no direct localStorage in components.

## Security
- Secrets: `process.env` only — never hardcode. Never commit `.env`.
- Auth tokens: HttpOnly cookies — never localStorage.
- All input validated server-side with Zod. Webhook signatures verified.
- Error responses: never expose stack traces, SQL, file paths, schema details.
- Rate limits: login 5/15min, register 3/hr, API 100req/min/tenant.
- No `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`.
- `tenantId` on every DB query — 404 (not 403) when cross-tenant.

## Anti-Patterns (NEVER)
- Raw `<select>` for filters · `style={{}}` inline · hardcoded hex colors
- Components over 400 lines · prop drilling > 3 levels · logic in JSX returns
- Context arrays in `useEffect` deps · localStorage in components/hooks
- Records without `tenantId` · mutations without `addAuditLog` · RBAC-unguarded UI
- `any` type · `@ts-ignore` · `as Type` to silence errors
- `console.log` in prod · silent catch blocks · duplicate type definitions

## Git
- NEVER run `git commit`, `git push`, or `git add` unless explicitly told.
- Never commit directly to main/master. Always push to a new branch.

## File Naming
All files: kebab-case. `contacts-table.tsx` ✓ · `ClientTable.tsx` ✗. Services: `contacts.service.ts` (same name FE + BE).
