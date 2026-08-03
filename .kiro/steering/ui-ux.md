---
description: LeadCRM UI/UX principles — design tokens, typography, component specs, layout rules, motion system. Always loaded.
inclusion: always
---

# LeadCRM — UI/UX Standards

## Design Token Quick Reference

### Backgrounds
```
body dark:     #030712   → bg-[#030712]
cards dark:    #0F172A   → bg-slate-900
body light:    #F8FAFC   → bg-slate-50
surface light: #FFFFFF   → bg-white
surface dark:  rgba(255,255,255,0.02) → bg-white/[0.02]
```

### Borders
```
light:  #E5E7EB   → border-gray-200
dark:   rgba(255,255,255,0.05) → border-white/[0.05]
subtle: rgba(255,255,255,0.03) → border-white/[0.03]
```

### Brand & Semantic Colors
```
primary blue:   #3B82F6  → text-blue-500 / bg-blue-500
primary CTA:    #2563EB  → bg-blue-600
success / won:  #10B981  → text-emerald-500
danger / lost:  #EF4444  → text-red-500
warning:        #F59E0B  → text-amber-500
```

### Text
```
light primary:   text-slate-900
light secondary: text-slate-500
dark primary:    text-white
dark secondary:  text-slate-400
```

## Typography Scale

| Role | Size | Weight | Class |
|---|---|---|---|
| Page title | 24px | Bold | `font-display text-2xl font-bold tracking-tight` |
| Section heading | 16px | SemiBold | `text-base font-semibold` |
| Card title | 14px | SemiBold | `text-sm font-semibold tracking-tight` |
| Body | 14px | Regular | `text-sm` |
| Label / meta | 12px | Medium | `text-xs font-medium text-slate-500` |
| Micro label | 10px | Bold | `text-[10px] font-bold uppercase tracking-[0.05em]` |

Fonts: **Inter** (body/UI) · **Space Grotesk** (page `<h1>` titles only) · **JetBrains Mono** (code)

## Component Shell Standards

```tsx
// Card
<div className="rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl p-6">

// Input
<input className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-white/[0.02] px-3 text-sm text-slate-900 dark:text-white
  placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors">

// Primary Button
<button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700
  text-white text-sm font-semibold shadow-md shadow-blue-500/20
  active:scale-95 transition-all">

// Outline Button
<button className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-transparent text-slate-700 dark:text-slate-300
  text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors">
```

## Status Badge Color Map

| Status | Classes |
|---|---|
| Hot | `bg-red-500/10 border-red-500/20 text-red-500` |
| Warm | `bg-amber-500/10 border-amber-500/20 text-amber-500` |
| Cold | `bg-blue-500/10 border-blue-500/20 text-blue-500` |
| Won / Active / Completed | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500` |
| Lost / Danger | `bg-red-500/10 border-red-500/20 text-red-500` |
| Cancelled / Inactive | `bg-slate-500/10 border-slate-500/20 text-slate-500` |
| Pending / In Progress | `bg-amber-500/10 border-amber-500/20 text-amber-500` |

## Motion Specs (Canonical)

```typescript
// Side Sheet (drawer) — slides from right
{ type: 'spring', damping: 25, stiffness: 200 }
// initial: { x: '100%' } → animate: { x: 0 }

// Modal (centered) — scale + fade
{ type: 'spring', damping: 30, stiffness: 280 }
// initial: { opacity: 0, scale: 0.97, y: 8 }

// Backdrop — simple fade
{ duration: 0.15 }

// Page content entry
{ duration: 0.4 }
// initial: { opacity: 0, y: 15 }

// Empty state float loop
animate={{ y: [0, -6, 0] }}
transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
```

**Import:** `motion/react` only — never `framer-motion`. Always use `useReducedMotion()`.

## Dark Mode Rule

Every element must have paired dark mode classes. No light-only components ever ship.

```tsx
// Required pattern
<div className="bg-white dark:bg-white/[0.02] text-slate-900 dark:text-white
  border border-gray-200 dark:border-white/[0.05]">
```

## Layout Rules

- Sidebar: `w-64 fixed left-0 top-0 h-full`
- Topbar: `h-16 sticky top-0 z-30`
- Page header: `flex items-center justify-between mb-6` with `font-display text-2xl font-bold`
- Detail views (contacts, deals, users): **drawers/sheets only** — no `[id]` routes

## Accessibility Minimums

- All icon-only buttons must have `aria-label`
- Color contrast AA (4.5:1 text, 3:1 large/UI)
- Status conveyed with text/icon alongside color — never color alone
- Focus rings visible on all interactive elements
- Modals trap focus while open, return focus to trigger on close
- Form inputs: explicit `<label htmlFor>` — no placeholder-only labels
- Animations respect `useReducedMotion()`
