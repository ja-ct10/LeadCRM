---
description: LeadCRM UI/UX design tokens, typography, component specs, layout rules. Auto-loaded for frontend files.
inclusion: fileMatch
fileMatchPattern: "**/*.tsx,**/*.css"
---

# LeadCRM — UI/UX Standards

## Brand Palette (from index.css @theme)

| Token | Hex | Usage |
|---|---|---|
| `--color-brand` | #D94F4F | Primary actions, active states, CTA buttons |
| `--color-brand-hover` | #C24545 | Hover state for primary |
| `--color-brand-light` | rgba(217,79,79,0.08) | Subtle brand backgrounds |
| `--color-deep-slate` | #25313D | Dark surfaces, sidebar, primary text |
| `--color-soft-neutral` | #F5F6F7 | Light backgrounds (canvas) |
| `--color-pure-surface` | #FFFFFF | Cards, tables, dialogs |
| `--color-muted-teal` | #5F8F88 | Success, positive indicators |

## Semantic Colors

| Purpose | Light Mode | Dark Mode |
|---|---|---|
| Success / Won | emerald-500 #10B981 | Same |
| Danger / Lost | red-500 #EF4444 | Same |
| Warning | amber-500 #F59E0B | Same |
| Info | blue-500 #3B82F6 | Same |

## Typography

| Role | Class |
|---|---|
| Page title | `font-heading text-2xl font-bold tracking-tight` |
| Section heading | `text-base font-semibold` |
| Card title | `text-sm font-semibold tracking-tight` |
| Body | `text-sm` |
| Label / meta | `text-xs font-medium text-slate-500` |
| Micro label | `text-[10px] font-bold uppercase tracking-[0.05em]` |

Fonts (from @theme):
- Body: Inter / Poppins (`--font-body`)
- Display/Headings: Inter Tight / League Spartan (`--font-heading`)
- Subtitle: Neue Machina (`--font-subtitle`)
- Code: JetBrains Mono (`--font-mono`)

## Component Standards

```tsx
// Card
<div className="rounded-2xl border border-[var(--color-surface-border)]
  bg-[var(--color-surface)] shadow-[var(--color-card-shadow)] p-6
  dark:bg-white/[0.02] dark:border-white/[0.05]">

// Primary Button (brand red)
<button className="h-9 px-4 rounded-xl bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]
  text-white text-sm font-semibold active:scale-95 transition-all">

// Outline Button
<button className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-transparent text-slate-700 dark:text-slate-300
  text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors">

// Input
<input className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-white/[0.02] px-3 text-sm text-slate-900 dark:text-white
  placeholder:text-slate-400 focus:outline-none focus:border-[var(--color-brand)] transition-colors">
```

## Status Badge Map

| Status | Classes |
|---|---|
| Hot | `bg-red-500/10 border-red-500/20 text-red-500` |
| Warm | `bg-amber-500/10 border-amber-500/20 text-amber-500` |
| Cold | `bg-blue-500/10 border-blue-500/20 text-blue-500` |
| Won / Active / Completed | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500` |
| Lost / Danger | `bg-red-500/10 border-red-500/20 text-red-500` |
| Cancelled / Inactive | `bg-slate-500/10 border-slate-500/20 text-slate-500` |
| Pending / In Progress | `bg-amber-500/10 border-amber-500/20 text-amber-500` |

## Motion Specs

```typescript
import { motion, useReducedMotion } from 'motion/react'; // NEVER framer-motion

// Side Sheet — spring slide from right
{ type: 'spring', damping: 25, stiffness: 200 }

// Modal — scale + fade
{ type: 'spring', damping: 30, stiffness: 280 }
// initial: { opacity: 0, scale: 0.97, y: 8 }

// Backdrop — simple fade
{ duration: 0.15 }

// Page content entry
{ duration: 0.4 }
// initial: { opacity: 0, y: 15 }
```

Always use `useReducedMotion()` and respect user preference.

## Dark Mode

Every element requires paired dark mode classes. No light-only components ship.

## Layout

- Sidebar: fixed left, full height (`--color-sidebar` = #25313D)
- Canvas background: `--color-soft-neutral` (#F5F6F7)
- Topbar: sticky, z-30
- Page header: `flex items-center justify-between mb-6`
- Detail views: drawers/sheets only — no `[id]` routes

## Accessibility Minimums

- Icon-only buttons: `aria-label` required
- Color contrast: AA (4.5:1 text, 3:1 UI)
- Status: text/icon alongside color — never color alone
- Focus rings on all interactive elements
- Modals: trap focus, return focus on close
- Form inputs: explicit `<label htmlFor>` — no placeholder-only labels
- Animations: respect `useReducedMotion()`
