---
name: nextjs-patterns
description: Next.js 15 App Router standards for LeadCRM — client/server boundaries, dynamic imports, environment variables, metadata management, Tailwind v4 config, and migration-ready patterns. Apply when working on any App Router file, routing, SSR boundary, or env vars.
---

# Next.js 15 Patterns — LeadCRM

## SPA Entry Pattern (Only Approved Form)

```tsx
// app/layout.tsx — Server Component, no 'use client'
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'LeadCRM', description: '...' };
export const viewport: Viewport = { themeColor: '#07142A' }; // SEPARATE from metadata

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

// app/page.tsx — client shell only
'use client';
import dynamic from 'next/dynamic';
const App = dynamic(() => import('../src/App'), { ssr: false });
export default function Home() { return <App />; }
```

## Client vs Server Decision

Add `'use client'` as the **first line** if the component uses any of:
- `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`
- `localStorage`, `sessionStorage`, `window`, `document`
- `motion/react` animations
- Event handlers (`onClick`, `onChange`, etc.)

## Dynamic Imports (Required For Heavy Components)

```tsx
// Required for: Pipeline (dnd-kit), Charts, PDF/export, any browser-only lib
const KanbanBoard = dynamic(
  () => import('./KanbanBoard'),
  { ssr: false, loading: () => <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" /> }
);
```

## Environment Variables

```typescript
// Client-safe — prefixed NEXT_PUBLIC_
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server-only — no prefix, never sent to browser
const dbUrl = process.env.DATABASE_URL;

// NEVER hardcode secrets
```

## Tailwind v4

```css
/* src/index.css — starts with this */
@import "tailwindcss";

/* Custom tokens in @theme block */
@theme {
  --font-display: 'Space Grotesk', sans-serif;
}
```

No `tailwind.config.js`. PostCSS via `postcss.config.mjs` using `@tailwindcss/postcss`.

## Public Assets

```tsx
// CORRECT — from public/
<img src="/leadcrm_logo.png" alt="LeadCRM" className="h-10 w-10" />

// WRONG — src/ is not served by Next.js
<img src="/src/assets/logo.png" />
```

## Common Build Errors

| Error | Cause | Fix |
|---|---|---|
| `themeColor` in metadata warning | Mixed in metadata export | Move to separate `viewport` export |
| `framer-motion not found` | Wrong import | `import from 'motion/react'` |
| `Cannot find module 'recharts'` | Direct import | Import from `ChartComponents.tsx` |
| Tailwind classes not applying | Missing `@import` | Add `@import "tailwindcss"` to top of `index.css` |

## Next.js Checklist

- [ ] `'use client'` as first line where needed
- [ ] No browser APIs in Server Components
- [ ] Heavy browser-only components use `dynamic(..., { ssr: false })`
- [ ] No business logic in `app/page.tsx` or `app/layout.tsx`
- [ ] `viewport` export separate from `metadata`
- [ ] Environment variables correct — no hardcoded secrets
- [ ] Public assets from `/` not `/src/assets/`
- [ ] `useEffect` deps use stable IDs — not Context arrays
