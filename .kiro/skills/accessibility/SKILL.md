---
name: accessibility
description: WCAG 2.2 Level AA accessibility standards for LeadCRM — semantic HTML, ARIA patterns, keyboard navigation, focus management, color contrast, and screen reader support. Apply when building or reviewing any UI component, modal, form, or interactive element.
---

# Accessibility — LeadCRM (WCAG 2.2 AA)

## Interactive Elements

```tsx
// Icon-only buttons MUST have aria-label
<button aria-label="Delete contact" className="w-9 h-9 rounded-lg ...">
  <Trash2 className="w-4 h-4 text-red-500" />
</button>

// Minimum touch target: 44×44px
// Visible focus ring — never remove outline without a replacement
<button className="... focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
```

## Color Contrast

- Body text: ≥ 7:1 (slate-900 on white / white on #030712)
- Secondary text: ≥ 4.5:1 (slate-500 / slate-400)
- Never convey meaning with color alone — pair with text or icon:

```tsx
// BAD
<span className="w-2 h-2 rounded-full bg-red-500" />

// GOOD
<span className="flex items-center gap-1.5">
  <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
  <span className="text-xs text-red-500 font-medium">Hot</span>
</span>
```

## Forms

```tsx
<div className="space-y-1.5">
  <label htmlFor="contact-email" className="text-xs font-medium text-slate-700 dark:text-slate-300">
    Email Address
  </label>
  <input
    id="contact-email" type="email"
    aria-describedby={errors.email ? 'email-error' : undefined}
    aria-invalid={!!errors.email}
  />
  {errors.email && (
    <p id="email-error" role="alert" className="text-xs text-red-500">{errors.email.message}</p>
  )}
</div>
```

No placeholder-only labels — they disappear on input and have no contrast guarantee.

## Modal Focus Management

```tsx
// Focus first interactive element on open
useEffect(() => { if (isOpen) firstFocusableRef.current?.focus(); }, [isOpen]);

// Return focus to trigger on close
useEffect(() => { if (!isOpen) triggerRef.current?.focus(); }, [isOpen]);
```

Modals must trap focus while open. `Escape` closes modal/drawer.

## Screen Reader Patterns

```tsx
// Live region for dynamic content
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? <Skeleton /> : <ContactTable />}
</div>

// Visually hidden text
<span className="sr-only">Loading contacts...</span>

// Decorative icons — hide from screen readers
<ArrowUpRight aria-hidden="true" className="w-3 h-3" />
```

## Tables

```tsx
<table role="grid" aria-label="Contacts">
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
</table>
```

## Reduced Motion

```tsx
import { useReducedMotion } from 'motion/react';
const shouldReduce = useReducedMotion();

<motion.div
  initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.97 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: shouldReduce ? 0 : 0.15 }}
>
```

## Accessibility Checklist

- [ ] Icon-only buttons have `aria-label`
- [ ] Contrast AA: 4.5:1 text, 3:1 large text/UI
- [ ] Status uses text/icon alongside color
- [ ] Focus rings visible on all interactive elements
- [ ] Modals trap focus, return focus on close
- [ ] Form inputs have `<label htmlFor>` — no placeholder-only
- [ ] Errors use `role="alert"` and `aria-describedby`
- [ ] Tables use `scope="col"` and `aria-label`
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Animations respect `useReducedMotion()`
- [ ] Dark mode contrast verified independently
