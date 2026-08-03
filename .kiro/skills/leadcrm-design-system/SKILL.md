---
name: leadcrm-design-system
description: LeadCRM visual design system — color tokens, typography scale, spacing, component specs (cards, modals, drawers, tables, badges, kanban), page layout rules, and design validation checklist. Apply before writing any UI component, page, modal, drawer, or form to ensure exact visual fidelity.
---

# LeadCRM Design System

> Full visual language reference. Apply before writing any UI code.
> For motion specs see the `motion-ui` skill. For RBAC/filter patterns see `frontend-patterns`.

## References

Detailed component specs, kanban card anatomy, skeleton loaders, scrollbar styles, and the full 17-section design reference live in:

→ `.agent/skills/leadcrm-design-system.md` (full spec)

This SKILL.md contains the activation rules and the most-used patterns for quick reference.

---

## Color Token Quick Reference

```
body dark:     bg-[#030712]
cards dark:    bg-slate-900
surface dark:  bg-white/[0.02]
surface light: bg-white
border dark:   border-white/[0.05]
border light:  border-gray-200
primary CTA:   bg-blue-600  hover:bg-blue-700
success:       text-emerald-500 / bg-emerald-500
danger:        text-red-500 / bg-red-500
warning:       text-amber-500 / bg-amber-500
```

## Core Component Shells

```tsx
// Card
<div className="rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl p-6">

// Primary Button
<button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700
  text-white text-sm font-semibold active:scale-95 transition-all">

// Outline Button
<button className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-transparent text-slate-700 dark:text-slate-300
  text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors">

// Input
<input className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-white/[0.02] px-3 text-sm text-slate-900 dark:text-white
  placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors">
```

## Status Badge Color Map

| Status | Classes |
|---|---|
| Hot | `bg-red-500/10 border-red-500/20 text-red-500` |
| Warm | `bg-amber-500/10 border-amber-500/20 text-amber-500` |
| Cold | `bg-blue-500/10 border-blue-500/20 text-blue-500` |
| Won / Active / Completed | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500` |
| Lost | `bg-red-500/10 border-red-500/20 text-red-500` |
| Cancelled / Inactive | `bg-slate-500/10 border-slate-500/20 text-slate-500` |
| Pending | `bg-amber-500/10 border-amber-500/20 text-amber-500` |

## Modal Pattern

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div /* backdrop */ initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div /* modal */
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900
          border border-gray-200 dark:border-white/[0.05] shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header, Body, Footer */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

## Drawer Pattern

```tsx
<motion.div
  initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
  className="fixed right-0 top-0 h-full z-50 w-full max-w-lg
    bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-white/[0.05]
    shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col">
```

## Page Header (Every Page)

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
      {pageTitle}
    </h1>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
  </div>
  <div className="flex items-center gap-3">{/* action buttons */}</div>
</div>
```

## Design System Validation Checklist

- [ ] Colors use exact token classes — no hardcoded hex in JSX
- [ ] Page titles use `font-display` (Space Grotesk)
- [ ] Cards: `rounded-2xl border ... bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl`
- [ ] Modals: spring `{ damping: 30, stiffness: 280 }` with backdrop blur
- [ ] Drawers: slide from right, spring `{ damping: 25, stiffness: 200 }`
- [ ] Animations import from `motion/react` — never `framer-motion`
- [ ] Status badges use exact color map above — no ad-hoc colors
- [ ] Priority badges: `text-[10px] font-bold uppercase tracking-[0.05em]`
- [ ] Primary buttons: `rounded-xl` · Outline buttons: `rounded-lg`
- [ ] Every button has `active:scale-95`
- [ ] Dark mode classes on every element
- [ ] Form fields: label above, error below, `h-9` input height
- [ ] No inline `style={{}}` — Tailwind only
- [ ] Page header uses `font-display` h1
