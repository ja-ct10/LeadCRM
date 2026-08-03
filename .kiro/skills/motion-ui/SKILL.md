---
name: motion-ui
description: Production-ready motion system for LeadCRM using motion/react v12. Covers animation specs, spring physics, entrance/exit patterns, reduced-motion support, and performance rules. Apply when implementing any animation, transition, or motion pattern.
---

# Motion UI — LeadCRM

> Import from `motion/react` only. Never `framer-motion`.

```typescript
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
```

## Canonical Spring Configs

```typescript
// Side Sheet (drawer) — slides from right
{ type: 'spring', damping: 25, stiffness: 200 }

// Modal (centered) — scale + fade
{ type: 'spring', damping: 30, stiffness: 280 }

// Backdrop — simple fade
{ duration: 0.15 }

// Page content entry
initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}

// Empty state float loop
animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}

// Button press (Tailwind — no JS)
active:scale-95
```

## Modal Pattern

```tsx
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div key="modal"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 pointer-events-auto">
          {children}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

## Drawer Pattern

```tsx
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div key="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div key="sheet"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full z-50 w-full max-w-lg
          bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-white/[0.05]
          shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col"
      >
        {children}
      </motion.div>
    </>
  )}
</AnimatePresence>
```

## Reduced Motion (Always Required)

```tsx
const shouldReduceMotion = useReducedMotion();

<motion.div
  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
>
```

## Performance Rules

- Animate `transform` and `opacity` only — never `width`, `height`, `top`, `left`
- Use `layout` prop for layout changes, not manual dimension animation
- Durations: micro-interactions 100–150ms · UI transitions 150–250ms · page 300–400ms · loops 2–4s

## Stagger Pattern

```tsx
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => <motion.li key={i.id} variants={item}><Card /></motion.li>)}
</motion.ul>
```

## Motion Checklist

- [ ] Import from `motion/react` — never `framer-motion`
- [ ] Modal uses `{ damping: 30, stiffness: 280 }`
- [ ] Drawer uses `{ damping: 25, stiffness: 200 }`
- [ ] `AnimatePresence` wraps all enter/exit
- [ ] `useReducedMotion()` checked — animations reduced when true
- [ ] Only `transform` and `opacity` animated
- [ ] Backdrop uses `duration: 0.15` fade (not spring)
