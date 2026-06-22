---
name: nextjs-patterns
description: Next.js 15 App Router patterns for LeadCRM — use before writing any page, component, layout, or data fetching code. Covers SSR/client boundaries, dynamic imports, Tailwind v4, metadata, performance, and environment configuration.
---

# Next.js 15 Patterns for LeadCRM

> These rules apply to every file that touches the Next.js layer — app directory, layouts, pages, and any component with SSR implications.

---

## 1. App Router Structure

- Entry shell: `app/layout.tsx` (root layout, Server Component) + `app/page.tsx` (SPA loader)
- The entire CRM is loaded client-side — no server rendering of CRM content:
  ```tsx
  // app/page.tsx — this is the only pattern, never add logic here
  import dynamic from 'next/dynamic';
  const App = dynamic(() => import('../src/App'), { ssr: false });
  export default function Home() { return <App />; }
  ```
- `app/layout.tsx` stays a Server Component — only import CSS and set metadata there, nothing else
- Server Components have no access to hooks, browser APIs, or React context

---

## 2. Client Boundary Rules

Mark a file `'use client'` if it uses **any** of the following:

- `useState`, `useEffect`, `useContext`, `useRef`, `useCallback`, `useMemo`
- `localStorage`, `sessionStorage`, `window`, `document`, `navigator`
- `motion/react` animations
- Event handlers (`onClick`, `onChange`, etc.) defined in the component
- Any third-party library that is browser-only

```tsx
// CORRECT — 'use client' at the very top, before imports
'use client';
import React, { useState } from 'react';
```

**Never** put `'use client'` in `app/layout.tsx` or `app/page.tsx` — those are the SSR boundary shells.

---

## 3. Dynamic Imports

Use `next/dynamic` with `{ ssr: false }` for any heavy browser-only component or library:

```tsx
// For the SPA entry (always)
const App = dynamic(() => import('../src/App'), { ssr: false });

// For heavy browser-only libraries (PDF, grid, chart editors)
const HeavyComponent = dynamic(
  () => import('../components/HeavyComponent'),
  { ssr: false, loading: () => <Skeleton /> }
);
```

Do not use `next/dynamic` for lightweight components that already have `'use client'` — only use it when the module itself would break SSR or when you want to defer loading for performance.

---

## 4. Static Assets & Images

- All static files are served from `public/` — reference as `/filename.ext`
- Logo: `public/leadcrm_logo.png` — reference as `/leadcrm_logo.png`
- **Never** reference `/src/assets/...` paths — they are not served by Next.js
- Use standard `<img>` tags unless `next/image` optimization is explicitly required
- Manifest and service worker live in `public/` — `manifest.json`, `sw.js`

---

## 5. CSS & Tailwind v4

- Global CSS lives in `src/index.css`, starts with `@import "tailwindcss"`
- **No `tailwind.config.js`** — Tailwind v4 is configured entirely via CSS `@theme` blocks
- PostCSS configured in `postcss.config.mjs` with `@tailwindcss/postcss`
- Dark mode is controlled by the `.dark` class on `<html>` — set by the theme toggle in `App.tsx`

```css
/* Every UI element needs both light and dark variants */
.element {
  @apply bg-white dark:bg-slate-900;
  @apply text-slate-900 dark:text-white;
  @apply border-gray-200 dark:border-white/[0.05];
}
```

---

## 6. Metadata & Viewport

```tsx
// app/layout.tsx — correct pattern
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'LeadCRM',
  description: 'SaaS CRM for IT, Security, and Telecom',
};

// viewport must be a separate export — NOT inside metadata
export const viewport: Viewport = {
  themeColor: '#07142A',
};
```

Never put `themeColor`, `width`, or `initialScale` inside the `metadata` export — Next.js 15 requires them in `viewport`.

---

## 7. Environment Variables

- Client-visible variables: prefix with `NEXT_PUBLIC_` — accessible in browser and server
- Server-only variables: define in `next.config.ts` under `env: {}` — never exposed to browser
- **Never hardcode** API keys, database URLs, or secrets anywhere in source files

```typescript
// CORRECT — always use process.env
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const dbUrl  = process.env.DATABASE_URL;

// WRONG — hardcoded secrets
const apiUrl = 'https://api.myapp.com';
```

---

## 8. Performance Patterns

**Use `useMemo` for:**
- Filtered lists: `filteredContacts`, `filteredDeals`, `filteredWorkflows`
- Computed aggregates: totals, counts, grouped data
- Any value derived from a large array that is used in render

**Use `useCallback` for:**
- Event handlers passed as props to child components
- Functions used as `useEffect` dependencies

**Use `useRef` for:**
- Storing values needed inside effects without triggering re-renders
- Referencing large Context arrays inside effects (avoids infinite loops)

**Avoid:**
- Anonymous functions in `useEffect` dependency arrays — they cause infinite re-renders
- Placing entire Context arrays (`contacts`, `deals`, `users`) in `useEffect` deps — use `useRef` instead
- Recalculating derived data on every render — always wrap in `useMemo`

---

## 9. Next.js Config

```typescript
// next.config.ts — minimal, correct structure
import type { NextConfig } from 'next';

const config: NextConfig = {
  // SaaS CRM — no static export, always server-rendered shell
  output: undefined,
  env: {
    // Server-only env vars exposed to Next.js runtime
  },
};

export default config;
```

Do not enable `output: 'export'` — LeadCRM requires a Node.js server for the App Router shell.

---

## Quick Reference

| Rule | Correct Pattern |
|---|---|
| SPA entry | `dynamic(() => import('../src/App'), { ssr: false })` |
| Browser APIs | Only inside `'use client'` components |
| `'use client'` placement | First line of file, before all imports |
| Dark mode | `.dark` class on `<html>`, Tailwind `dark:` variants on every element |
| Logo path | `/leadcrm_logo.png` from `public/` |
| Tailwind config | CSS `@theme` block only — no `tailwind.config.js` |
| `themeColor` | `export const viewport: Viewport` — never inside `metadata` |
| Secrets | Always `process.env.VAR_NAME` — never hardcoded |
