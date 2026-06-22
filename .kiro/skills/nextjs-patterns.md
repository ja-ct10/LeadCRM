---
name: nextjs-patterns
description: Next.js 15 App Router patterns for LeadCRM — use before writing any page, component, layout, or data fetching code
---

# Next.js 15 Patterns

## App Router Structure
- Entry: `app/layout.tsx` (root layout) + `app/page.tsx` (loads SPA)
- The entire SPA is loaded client-side: `dynamic(() => import('../src/App'), { ssr: false })`
- All components that use `localStorage`, `window`, or React hooks need `'use client'`
- Server Components = no hooks, no browser APIs — only for layout shells

## Component Rules
- Mark any component that uses: `useState`, `useEffect`, `useContext`, `localStorage`, `window`, motion animations → `'use client'`
- Keep `app/layout.tsx` as a Server Component — only import CSS and metadata there
- Use `next/dynamic` with `{ ssr: false }` for any heavy browser-only library (react-grid-layout, jspdf, etc.)

## Page Pattern
```tsx
// app/page.tsx — always like this, never add logic here
'use client';
import dynamic from 'next/dynamic';
const App = dynamic(() => import('../src/App'), { ssr: false });
export default function Home() { return <App />; }
```

## Image & Static Assets
- All static files served from `public/` — reference as `/filename.png`
- Logo: `/leadcrm_logo.png` — NEVER use `/src/assets/...` paths
- Use standard `<img>` tags, not `next/image`, unless explicitly requested

## CSS & Tailwind v4
- Global CSS in `src/index.css` — starts with `@import "tailwindcss"`
- No `tailwind.config.js` — Tailwind v4 is configured via CSS `@theme` block
- PostCSS via `postcss.config.mjs` with `@tailwindcss/postcss`
- Dark mode uses `.dark` class on `<html>` — pattern: `text-slate-900 dark:text-white`

## Metadata
```tsx
// app/layout.tsx
export const metadata: Metadata = { title: '...', description: '...' };
export const viewport: Viewport = { themeColor: '#07142A' }; // NOT in metadata
```

## Environment Variables
- Client-safe vars: `NEXT_PUBLIC_` prefix
- Server-only vars: defined in `next.config.ts` under `env: {}`
- Never hardcode API keys — always `process.env.VAR_NAME`

## Performance
- Use `useMemo` for expensive filtered/computed lists (filteredContacts, filteredDeals, etc.)
- Use `useCallback` for event handlers passed as props
- Avoid anonymous functions in dependency arrays — they cause infinite re-renders
- Use `useRef` when you need latest value in an effect without re-running it
