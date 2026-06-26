---
name: nextjs-patterns
description: Enterprise Next.js 15 App Router standards for LeadCRM. Defines architecture, client/server boundaries, performance optimization, routing conventions, dynamic imports, environment variables, metadata management, and migration-ready patterns.
---

# Next.js 15 Engineering Standards — LeadCRM

> These rules govern every file that touches the Next.js layer — app directory, layouts, pages, routing, and any component with SSR implications.

---

## Core Philosophy

LeadCRM uses Next.js as an **application shell**, not as a framework for business logic.

```
Next.js (shell + routing)
  ↓
SPA Entry (app/page.tsx)
  ↓
React CRM Application (src/App.tsx)
  ↓
DataContext (state + data operations)
  ↓
Future API Layer (Express + PostgreSQL)
```

The CRM currently operates as a client-side SPA. Every architectural decision must preserve a **seamless migration path** to:
- Express + Node.js API
- PostgreSQL + Prisma/Drizzle
- NextAuth.js authentication

Never create patterns that block this migration.

---

## 1. Application Entry Points

### `app/layout.tsx` — Root Shell (Server Component)

**Responsible for:**
- `metadata` export
- `viewport` export
- Global CSS import
- `<html>` and `<body>` shell

**Never contains:**
- Business logic
- React hooks
- `localStorage` or `window` access
- Context mutations
- `'use client'` directive

```tsx
// app/layout.tsx — correct pattern
import type { Metadata, Viewport } from 'next';
import './globals.css'; // or src/index.css

export const metadata: Metadata = {
  title: 'LeadCRM',
  description: 'SaaS CRM for IT, Security, and Telecom',
};

// viewport is a SEPARATE export — never put it inside metadata
export const viewport: Viewport = {
  themeColor: '#07142A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### `app/page.tsx` — SPA Loader (Client Component)

**Responsible for:**
- Loading the SPA dynamically with `ssr: false`

**Never contains:**
- Data fetching
- Business logic
- Permission checks
- Feature implementation of any kind

```tsx
// app/page.tsx — the only approved pattern
'use client';
import dynamic from 'next/dynamic';

const App = dynamic(() => import('../src/App'), { ssr: false });

export default function Home() {
  return <App />;
}
```

---

## 2. Client vs Server Component Decision

### Decision Framework

Before creating any component, ask: does it use any of the following?

| API | Requires `'use client'` |
|---|---|
| `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef` | ✅ Yes |
| `useContext` | ✅ Yes |
| `localStorage`, `sessionStorage`, `window`, `document`, `navigator` | ✅ Yes |
| `motion/react` animations | ✅ Yes |
| Event handlers (`onClick`, `onChange`, etc.) | ✅ Yes |
| Third-party browser-only library | ✅ Yes |

If **any** answer is yes → add `'use client'` as the **first line** of the file, before all imports.

### Server Components

Allowed in Server Components:
- Layout wrappers and shells
- Metadata declarations
- Static content rendering
- Importing and composing other Server or Client Components

Not allowed in Server Components:
- Any hook (`useState`, `useEffect`, etc.)
- Browser APIs (`localStorage`, `window`)
- Event handlers
- React Context consumption

### Client Components

```tsx
// CORRECT — 'use client' as the absolute first line
'use client';
import React, { useState } from 'react';

export function MyComponent() { ... }
```

Never add `'use client'` to `app/layout.tsx` or `app/page.tsx` shell — those are structural entry points.

---

## 3. Routing Standards

**App Router only.** The `pages/` directory is not used in this project — never introduce `pages/` router patterns.

**Keep routes shallow:**

```
app/
  dashboard/
  contacts/
  pipeline/
  reports/
  settings/
```

Avoid deeply nested route trees — they create maintenance overhead and complicate the shell/SPA boundary.

---

## 4. Dynamic Import Strategy

### Mandatory Dynamic Imports

Use `dynamic(() => import(...), { ssr: false })` for any component that uses:

- Charts (`ChartComponents.tsx` consumers)
- Kanban boards (Pipeline with `@dnd-kit`)
- PDF generators
- Drag-and-drop systems
- Any browser-only third-party library

```tsx
// Correct dynamic import pattern
const KanbanBoard = dynamic(
  () => import('./KanbanBoard'),
  { ssr: false, loading: () => <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" /> }
);
```

### Bundle Size Rule

If a component adds more than ~100KB to the bundle, evaluate whether it should be dynamically imported to avoid blocking the initial load.

### When NOT to use `next/dynamic`

Do not use `next/dynamic` for lightweight components that already have `'use client'` — it adds unnecessary loading complexity. Reserve it for genuinely heavy or browser-only modules.

---

## 5. Data Fetching Architecture

### Current State

All data operations flow through DataContext (localStorage-backed). This is intentional for the current phase.

### Migration-Ready Rule — Non-Negotiable

The approved data flow is:

```
Page Component
  ↓
Custom Hook (useContacts, useDeals, etc.)
  ↓
DataContext (current: localStorage | future: fetch API)
  ↓
Future Express + PostgreSQL API
```

**Never place:**
- API logic directly inside components
- `localStorage` calls inside JSX or render functions
- Business rules inside page files
- Storage-specific logic that couples UI to implementation details

This ensures a PostgreSQL + Express migration requires changes only to DataContext internals — not to any component or hook.

---

## 6. Browser API Safety

Browser APIs are only accessible inside `'use client'` components. Accessing them in Server Components or during SSR will throw a `ReferenceError`.

**Safe usage pattern:**

```tsx
'use client';
import { useEffect } from 'react';

export function ThemeApplier() {
  useEffect(() => {
    // Safe — this runs only on the client after hydration
    const saved = localStorage.getItem('app_theme');
    if (saved === 'Dark') document.documentElement.classList.add('dark');
  }, []);
  return null;
}
```

**Never access these inside:** layouts, Server Components, or any file without `'use client'`.

---

## 7. Image & Static Asset Standards

- All static assets live in `public/` — referenced as absolute paths from root
- Logo: `public/leadcrm_logo.png` → reference as `/leadcrm_logo.png`
- **Never** reference `/src/assets/...` paths — Next.js does not serve the `src/` directory
- Use standard `<img>` tags; `next/image` is not required unless image optimization is explicitly needed
- Service worker and manifest: `public/sw.js`, `public/manifest.json`

```tsx
// CORRECT
<img src="/leadcrm_logo.png" alt="LeadCRM" className="h-10 w-10 object-cover" />

// WRONG
<img src="/src/assets/logo.png" alt="LeadCRM" />
```

---

## 8. Metadata Management

**`themeColor`, `viewport`, and responsive directives belong in `viewport` export — never inside `metadata`.**

```tsx
// CORRECT — separate exports
export const metadata: Metadata = {
  title: 'LeadCRM',
  description: 'SaaS CRM for IT solutions providers, security firms, and telecom agencies',
};

export const viewport: Viewport = {
  themeColor: '#07142A',
  width: 'device-width',
  initialScale: 1,
};
```

Next.js 15 throws a warning when `themeColor` appears inside `metadata` — keep them separated.

---

## 9. Environment Variables

| Variable Type | Prefix | Accessible In |
|---|---|---|
| Client-safe | `NEXT_PUBLIC_` | Browser + Server |
| Server-only | (no prefix) | Server only — never sent to browser |

```typescript
// CORRECT
const apiUrl = process.env.NEXT_PUBLIC_API_URL;   // client-safe
const dbUrl  = process.env.DATABASE_URL;           // server-only

// WRONG — never hardcode secrets
const apiKey = 'sk_live_abcdef123456';
```

Never commit `.env` files with real secrets. Always use `.env.example` with placeholder values.

---

## 10. Tailwind v4 Standards

- Global CSS in `src/index.css` — starts with `@import "tailwindcss"`
- **No `tailwind.config.js`** — Tailwind v4 uses CSS `@theme` blocks for configuration
- PostCSS configured in `postcss.config.mjs` via `@tailwindcss/postcss`

### Dark Mode

Dark mode is driven by the `.dark` class on `<html>`, toggled by the theme switch in `App.tsx`.

**Every UI element must support dark mode:**

```tsx
// CORRECT — both light and dark variants
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-gray-200 dark:border-white/[0.05]">
```

Never ship a component that only has light mode classes.

---

## 11. Performance Standards

### `useMemo`

Use for expensive computations and derived data from large arrays:

```tsx
// CORRECT — memoized filter
const filteredDeals = useMemo(
  () => deals.filter(d => d.stageId === activeStageId),
  [deals, activeStageId]
);
```

Do not add `useMemo` preemptively — only when a performance issue is measured or clearly predicted.

### `useCallback`

Use when passing handlers to memoized child components to maintain referential stability:

```tsx
const handleDealClick = useCallback((id: string) => {
  setSelectedDeal(id);
}, []);
```

Do not wrap every function — only those passed as props to children or used in dependency arrays.

### `useRef`

Use when:
- Storing a mutable value that should not trigger re-renders
- Accessing DOM elements
- Holding Context arrays inside effects without causing infinite loops

---

## 12. Effect Safety Rules

Large Context arrays as `useEffect` dependencies cause infinite re-render loops. This is one of the most common bugs in this codebase.

```tsx
// WRONG — entire array is a dependency, triggers on every render
useEffect(() => {
  processDeals(deals);
}, [deals]); // ❌ re-runs whenever any deal anywhere changes

// CORRECT — use stable scalar identifier
useEffect(() => {
  const deal = deals.find(d => d.id === selectedDealId);
  if (deal) processDeal(deal);
}, [selectedDealId]); // ✅ only re-runs when selection changes

// CORRECT — use ref to hold array without dependency
const dealsRef = useRef(deals);
dealsRef.current = deals;
useEffect(() => {
  const deal = dealsRef.current.find(d => d.id === selectedDealId);
}, [selectedDealId]);
```

**Never** add `users`, `contacts`, `deals`, `organizations`, or `campaigns` arrays directly to `useEffect` dependencies when sourced from Context.

---

## 13. Error & Loading State Standards

Every major module must handle all three states before rendering content:

- **Loading state** — skeleton or spinner while data is pending
- **Empty state** — clear message when no data exists (use `<EmptyState>` component)
- **Error state** — user-facing message when something fails

Required for: Dashboard, Reports, Pipeline, Contacts, Campaigns, Workflows, Audit Logs.

---

## 14. SEO & Crawling Policy

LeadCRM routes are authenticated — they are not meant to be publicly indexed.

- Do not add complex SEO metadata to authenticated CRM pages
- Focus optimization effort on application UX, not search engine discoverability
- `robots.txt` should block CRM routes from crawlers when deployed to production

---

## Next.js Validation Checklist

Run before marking any Next.js-adjacent task complete:

- [ ] Correct client/server boundary established (`'use client'` where needed)
- [ ] No browser APIs accessed inside Server Components
- [ ] Heavy browser-only components use `dynamic(..., { ssr: false })`
- [ ] No business logic in `app/page.tsx` or `app/layout.tsx`
- [ ] Environment variables used correctly (no hardcoded secrets)
- [ ] Public assets referenced from `/` not from `/src/assets/`
- [ ] Dark mode classes applied to all UI elements
- [ ] No hydration mismatch risks (consistent server/client rendering)
- [ ] Migration-ready data flow: Page → Hook → DataContext → Future API
- [ ] App Router patterns followed — no `pages/` directory patterns
- [ ] `useEffect` dependencies use stable identifiers, not Context arrays
- [ ] Error, loading, and empty states handled in all data-dependent modules

---

## Master Next.js Directive

**Use Next.js as infrastructure, not as a business logic container.**

```
Next.js owns:    Routing | Layouts | Shell | Asset serving | Metadata
LeadCRM owns:    Hooks | Context | Components | Business rules | Data ops
```

The boundary is sacred. Crossing it creates coupling that will be painful to undo during the PostgreSQL + Express migration.

A future backend migration should require **zero frontend component changes**. If it would require component changes, the architecture is wrong — fix it now.
