# LeadCRM Design System — MASTER

> Generated: 2026-08-10  
> Version: 1.0.0  
> Status: Production  
> Target Quality Bar: Linear / Attio / Notion / Modern Atlassian / Framer

---

## Project Identity

**Type:** Enterprise CRM for daily-use (sales, operations, service delivery)  
**Audience:** IT solutions providers, security firms, telecom agencies  
**Usage:** Multi-hour daily sessions, high-density information display  
**Quality Bar:** Premium intentionally-designed enterprise product

### Anti-Generic Rules (Taste Skill v2)

- ✗ No three identical cards in a row
- ✗ No repeated section rhythm
- ✗ No glassmorphism or neon gradients
- ✗ No Dribbble-style fake dashboards
- ✗ No generic shadcn default look
- ✓ Each primary workflow has distinct visual rhythm:
  - Leads = operational, action-focused
  - Customers = relationship-focused, detailed
  - Pipeline = momentum-focused, velocity indicators
  - Campaigns = communication-focused, engagement metrics

---

## Color System

### Semantic Design Tokens (CSS Variables)

```css
:root {
  /* Backgrounds */
  --background: #f7fafc;
  --surface: #ffffff;
  --surface-secondary: #e3f2fd;

  /* Brand (User-Customizable Accent) */
  --primary: #2196f3;
  --primary-dark: #0d47a1;
  --primary-hover: #1976d2;
  --primary-foreground: #ffffff;

  /* Neutrals */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
  --border: #d7e3f4;
  --border-subtle: #e2e8f0;

  /* Semantic */
  --success: #10b981;
  --success-bg: #d1fae5;
  --warning: #f59e0b;
  --warning-bg: #fef3c7;
  --error: #ef4444;
  --error-bg: #fee2e2;
  --info: #3b82f6;
  --info-bg: #dbeafe;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

  /* Focus Ring */
  --focus-ring: 0 0 0 3px rgba(33, 150, 243, 0.2);
}

.dark {
  /* Backgrounds */
  --background: #080616;
  --surface: #121826;
  --surface-secondary: #1a1953;

  /* Brand */
  --primary: #2f2fe4;
  --primary-dark: #162e93;
  --primary-hover: #4545e8;
  --primary-foreground: #f8fafc;

  /* Neutrals */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --border: #27324a;
  --border-subtle: #1e293b;

  /* Semantic (adjusted for dark) */
  --success: #34d399;
  --success-bg: rgba(52, 211, 153, 0.1);
  --warning: #fbbf24;
  --warning-bg: rgba(251, 191, 36, 0.1);
  --error: #f87171;
  --error-bg: rgba(248, 113, 113, 0.1);
  --info: #60a5fa;
  --info-bg: rgba(96, 165, 250, 0.1);

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.3);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.4);

  /* Focus Ring */
  --focus-ring: 0 0 0 3px rgba(47, 47, 228, 0.3);
}
```

### Accent Color System

Users can customize accent color via Appearance settings. Design system must use semantic tokens that automatically update:

- Buttons, links, tabs, focus rings → `var(--primary)`
- Hover states → `var(--primary-hover)`
- Pressed states → `var(--primary-dark)`
- Text on primary → `var(--primary-foreground)`

**Implementation:** Use CSS custom properties, never hardcoded blue/purple

---

## Typography

### Font Stack

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
```

### Scale

| Token           | Size | Line Height | Weight | Usage             |
| --------------- | ---- | ----------- | ------ | ----------------- |
| **display-2xl** | 40px | 48px        | 700    | Hero sections     |
| **display-xl**  | 32px | 40px        | 700    | Page titles       |
| **display-lg**  | 28px | 36px        | 600    | Section headers   |
| **display-md**  | 24px | 32px        | 600    | Card group titles |
| **heading-lg**  | 20px | 28px        | 600    | Card titles       |
| **heading-md**  | 18px | 28px        | 600    | Subheadings       |
| **heading-sm**  | 16px | 24px        | 600    | Small headers     |
| **body-lg**     | 16px | 24px        | 400    | Large body        |
| **body**        | 14px | 22px        | 400    | Default body      |
| **body-sm**     | 13px | 20px        | 400    | Dense tables      |
| **caption**     | 12px | 18px        | 500    | Labels, captions  |
| **overline**    | 11px | 16px        | 600    | Uppercase labels  |

### Rules

- Page titles: `font-display` (Space Grotesk)
- Body content: `font-sans` (Inter)
- Code/data: `font-mono` (JetBrains Mono)
- Minimum body size: 14px (never smaller)
- Line height: 1.5 minimum for body text

---

## Spacing & Layout

### Spacing Scale (8px base)

```css
--space-1: 4px; /* 0.5 */
--space-2: 8px; /* 1 */
--space-3: 12px; /* 1.5 */
--space-4: 16px; /* 2 */
--space-5: 20px; /* 2.5 */
--space-6: 24px; /* 3 */
--space-8: 32px; /* 4 */
--space-10: 40px; /* 5 */
--space-12: 48px; /* 6 */
--space-16: 64px; /* 8 */
--space-20: 80px; /* 10 */
```

### Density Level: 7/10 (Dashboard-Optimized)

- Comfortable for long sessions
- Not cramped, not spacious
- Prioritizes information density over whitespace
- Suitable for 1080p-1440p displays

### Layout Constraints

- **Max Width**: 1440px (centered)
- **Gutter**: 24px (lg screens), 16px (sm screens)
- **Sidebar**: 240px expanded / 56px collapsed
- **Topbar**: 56px height (sticky)
- **Page Header**: 52-56px (contextual breadcrumb)

---

## Border Radius

| Token    | Value  | Usage                   |
| -------- | ------ | ----------------------- |
| **sm**   | 8px    | Small elements, tags    |
| **md**   | 12px   | Buttons, inputs, badges |
| **lg**   | 16px   | Cards, panels           |
| **xl**   | 20px   | Large cards, modals     |
| **2xl**  | 24px   | Drawers, major surfaces |
| **full** | 9999px | Pills, avatars          |

**Rule:** Use only these 6 values - no custom radii

---

## Elevation & Shadows

| Level | Shadow             | Usage                       |
| ----- | ------------------ | --------------------------- |
| **0** | none               | Flat elements, borders only |
| **1** | `var(--shadow-sm)` | Subtle lift (cards on page) |
| **2** | `var(--shadow-md)` | Dropdown menus, popovers    |
| **3** | `var(--shadow-lg)` | Modal dialogs               |
| **4** | `var(--shadow-xl)` | Drawers, command palette    |

**Rule:** Minimal layered depth only - no floating shadows or neon glows

---

## Component Specs

### Buttons

#### Sizes

```tsx
// Small
h-8 px-3 text-xs gap-1.5

// Default
h-9 px-4 text-sm gap-2

// Large
h-10 px-5 text-base gap-2

// Icon-only
w-9 h-9
```

#### Variants

```tsx
// Primary
bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-dark)]
text-[var(--primary-foreground)] font-semibold
rounded-xl shadow-sm active:scale-95 transition-all

// Secondary
bg-surface-secondary border border-border
text-text-primary hover:bg-surface
rounded-lg active:scale-98 transition-all

// Outline
border border-border bg-transparent
text-text-primary hover:bg-surface
rounded-lg transition-colors

// Ghost
bg-transparent hover:bg-surface
text-text-secondary hover:text-text-primary
rounded-lg transition-colors

// Destructive
bg-error hover:bg-error/90
text-white font-semibold
rounded-xl shadow-sm active:scale-95 transition-all
```

### Inputs

```tsx
// Default
h-9 px-3 rounded-md
border border-border bg-surface
text-text-primary placeholder:text-text-tertiary
focus:outline-none focus:ring-[var(--focus-ring)] focus:border-primary
transition-all

// With Label
<label className="text-sm font-medium text-text-secondary mb-1.5 block">
<input />
{error && <p className="text-xs text-error mt-1">{error}</p>}
```

### Cards

```tsx
// Standard Card
rounded-xl border border-border
bg-surface shadow-sm
p-6

// Interactive Card
hover:shadow-md hover:border-primary/20
transition-all cursor-pointer

// Dense Card (dashboards)
rounded-lg p-4
```

### Badges

```tsx
// Status Badge Pattern
inline-flex items-center gap-1
px-2 py-0.5 rounded-md
text-xs font-medium
border

// Colors by Status
Hot: bg-error/10 border-error/20 text-error
Warm: bg-warning/10 border-warning/20 text-warning
Cold: bg-info/10 border-info/20 text-info
Won/Active: bg-success/10 border-success/20 text-success
Lost: bg-error/10 border-error/20 text-error
Pending: bg-warning/10 border-warning/20 text-warning
```

### Tables

```tsx
// Table Container
rounded-lg border border-border overflow-hidden

// Header
bg-surface-secondary border-b border-border
px-4 py-3 text-xs font-semibold uppercase tracking-wider
text-text-secondary

// Row
border-b border-border last:border-0
px-4 py-3 text-sm text-text-primary
hover:bg-surface-secondary transition-colors

// Cell Alignment
text-left (default)
text-right (numbers, currency)
text-center (actions, icons)
```

---

## Motion System (motion/react v12)

### Spring Configs

```tsx
// Drawer (side sheet) — slides from right
{ type: 'spring', damping: 25, stiffness: 200 }

// Modal (centered) — scale + fade
{ type: 'spring', damping: 30, stiffness: 280 }

// Backdrop — simple fade
{ duration: 0.15 }

// Page content entry
initial={{ opacity: 0, y: 15 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4 }}
```

### Timing Scale

| Type           | Duration  | Easing      | Usage             |
| -------------- | --------- | ----------- | ----------------- |
| **Instant**    | 0-50ms    | linear      | Feedback, toggles |
| **Micro**      | 120-180ms | ease-out    | Hover, focus      |
| **Transition** | 220-280ms | ease-out    | Enter/exit        |
| **Entrance**   | 300-400ms | ease-out    | Page load         |
| **Ambient**    | 2-4s      | ease-in-out | Floating loops    |

### Animation Properties

- ✓ Animate: `transform`, `opacity` only
- ✗ Never animate: `width`, `height`, `top`, `left`
- Use `layout` prop for layout changes

### Reduced Motion

```tsx
const shouldReduceMotion = useReducedMotion();
<motion.div
  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
/>;
```

---

## Layout Patterns

### Global Shell

```
┌─────────────────────────────────────────────┐
│ Topbar (56px, sticky)                       │
├───────┬─────────────────────────────────────┤
│       │ Page Header (52-56px, breadcrumb)   │
│ Side  ├─────────────────────────────────────┤
│ bar   │                                     │
│ (240/ │ Main Content Area                   │
│ 56px) │ (max-w-[1440px], px-4 lg:px-6)     │
│       │                                     │
└───────┴─────────────────────────────────────┘
```

### Page Header (Contextual Breadcrumb)

**For EVERY module**, add this header below topbar:

```tsx
<div className="sticky top-14 z-30 border-b border-border bg-surface backdrop-blur-sm">
  <div className="max-w-[1440px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
    <div className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-primary">LeadCRM</span>
      <ChevronRight size={14} className="text-text-tertiary" />
      <span className="text-text-primary font-medium">{currentModule}</span>
    </div>
    <div className="flex items-center gap-2">
      {/* Optional: Create, Import, Filter, Export buttons */}
    </div>
  </div>
</div>
```

**Examples:**

- LeadCRM / Dashboard
- LeadCRM / Leads
- LeadCRM / Pipeline
- LeadCRM / Campaigns
- LeadCRM / Settings

### Standard Page Structure

```tsx
<div className="p-4 lg:p-6 space-y-6">
  {/* 1. Page Title + Actions */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="font-display text-2xl font-bold text-text-primary">
        {pageTitle}
      </h1>
      <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
    </div>
    <div className="flex items-center gap-3">{/* CTAs */}</div>
  </div>

  {/* 2. KPI Metrics (if applicable) */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
    {/* Metric cards */}
  </div>

  {/* 3. Toolbar (Search, Filters, View Toggles) */}
  <div className="flex items-center justify-between gap-4">
    {/* TrelloFilter or similar */}
  </div>

  {/* 4. Data Display (Table/Kanban/Grid) */}
  <div>{/* Content */}</div>

  {/* 5. Pagination */}
  <Pagination />
</div>
```

---

## Module-Specific Rhythms

### Leads (Operational)

- Dense table layout
- Quick action buttons visible
- Status badges prominent
- Fast filters (always visible)
- Metric: conversion rate, response time

### Customers (Relationship)

- More whitespace
- Profile photos prominent
- Timeline/history visible
- Detailed contact cards
- Metric: lifetime value, engagement score

### Pipeline (Momentum)

- Kanban cards with velocity indicators
- Age/rotation warnings (14d+ = red, 7-14d = amber)
- Forecast bar at top
- Swimlane grouping
- Metric: deal velocity, win rate

### Campaigns (Communication)

- Engagement metrics front and center
- Email/SMS previews
- Send status visual
- Click/open rates in cards
- Metric: open rate, CTR, conversion

**Rule:** No two modules should feel identical

---

## Accessibility (WCAG AA)

### Checklist

- [ ] Color contrast ≥ 4.5:1 (text on background)
- [ ] All interactive elements ≥ 44×44px (mobile)
- [ ] Keyboard navigation with visible focus states
- [ ] Alt text on all images/icons
- [ ] Semantic headings (h1 → h2 → h3)
- [ ] Reduced motion support via `useReducedMotion()`
- [ ] Screen reader labels on icon-only buttons
- [ ] Form labels visible (not placeholder-only)
- [ ] Error messages near fields, not top-only

### Focus States

```tsx
focus:outline-none focus:ring-[var(--focus-ring)] focus:border-primary
```

---

## Responsive Breakpoints

```css
/* Mobile First */
sm: 640px   /* Tablet */
md: 768px   /* Small desktop */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Layout Behavior

- **< 640px**: Single column, full-width sidebar overlay
- **640-1024px**: 2-3 column grids, sidebar overlay
- **1024px+**: Full multi-column, sidebar docked, collapsed option
- **1440px+**: Max content width, centered

---

## Technical Requirements

### Stack Constraints

- **Framework**: Next.js 15 (App Router), React 19
- **Styling**: Tailwind CSS v4 (CSS-first, no config file)
- **Motion**: `motion/react` v12 (NOT framer-motion)
- **Icons**: Lucide React
- **Charts**: Chart.js via ChartComponents.tsx wrapper
- **Forms**: react-hook-form + Zod

### Implementation Rules

- ✓ Use semantic design tokens (CSS variables)
- ✓ Every element has dark mode classes
- ✓ No inline `style={{}}` - Tailwind only
- ✓ No hardcoded colors - use tokens
- ✓ Preserve existing routes and business logic
- ✗ No backend modifications allowed
- ✗ No glassmorphism or decorative effects

---

## Quality Gate Checklist

Before considering redesign complete, verify:

### Visual

- [ ] No three identical cards in a row
- [ ] Each module has distinct visual rhythm
- [ ] Accent color swappable without breaking layout
- [ ] Dark mode parity with light mode
- [ ] Consistent spacing scale used throughout
- [ ] Typography scale followed precisely
- [ ] Border radius values limited to 6 options

### Functional

- [ ] All existing features preserved
- [ ] RBAC guards intact
- [ ] Data flows unchanged
- [ ] Forms still submit correctly
- [ ] Filters still work
- [ ] Pagination functional
- [ ] Drag-drop preserved (pipeline)

### Performance

- [ ] Animations only on transform/opacity
- [ ] Reduced motion supported
- [ ] No layout thrashing
- [ ] Images optimized (WebP/AVIF)
- [ ] Bundle size unchanged or smaller

### Accessibility

- [ ] WCAG AA contrast ratios met
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader friendly
- [ ] Touch targets ≥ 44×44px

---

## Next Steps

1. **Phase 1: Design Tokens** - Implement CSS variables in `index.css`
2. **Phase 2: Layout Shell** - Redesign sidebar + topbar + page header
3. **Phase 3: Component Library** - Update shared UI components
4. **Phase 4: Module Pages** - Apply module-specific rhythms
5. **Phase 5: Motion Polish** - Add micro-interactions
6. **Phase 6: QA Pass** - Verify quality gate checklist

---

**End of MASTER Design System**
