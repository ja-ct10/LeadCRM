---
name: leadcrm-design-system
description: LeadCRM visual design system — color tokens, typography scale, spacing, component specs, and page layout rules. Apply before writing any UI component, page, modal, drawer, or form to ensure exact visual fidelity across the entire application.
---

# LeadCRM Design System

> This skill defines the exact visual language of LeadCRM. Every pixel, every component, every layout decision derives from these rules. Apply before writing any UI code.

---

## 1. COLOR TOKENS

### Backgrounds
```
body (dark):          #030712        → bg-[#030712]
sidebar/cards (dark): #0F172A        → bg-slate-900
body (light):         #F8FAFC        → bg-slate-50
surface (light):      #FFFFFF        → bg-white
surface (dark):       rgba(255,255,255,0.02) → bg-white/[0.02]
```

### Borders
```
light: #E5E7EB                       → border-gray-200
dark:  rgba(255,255,255,0.05)        → border-white/[0.05]
subtle dark: rgba(255,255,255,0.03)  → border-white/[0.03]
```

### Brand Colors
```
primary blue:   #3B82F6  → text-blue-500 / bg-blue-500
primary CTA:    #2563EB  → bg-blue-600
CTA hover:      #1D4ED8  → bg-blue-700
```

### Semantic Colors
```
success / won:  #10B981  → text-emerald-500 / bg-emerald-500
danger / lost:  #EF4444  → text-red-500 / bg-red-500
warning / aging:#F59E0B  → text-amber-500 / bg-amber-500
purple accent:  #8B5CF6  → text-violet-500
pink accent:    #EC4899  → text-pink-500
indigo accent:  #6366F1  → text-indigo-500
orange accent:  #F97316  → text-orange-500
```

### Text
```
light primary:   #0F172A → text-slate-900
light secondary: #64748B → text-slate-500
dark primary:    #FFFFFF → text-white
dark secondary:  #94A3B8 → text-slate-400
```

---

## 2. TYPOGRAPHY SCALE

Font families:
- Body / UI:      **Inter** (weights: 400, 500, 600, 700)
- Display:        **Space Grotesk** (weights: 500, 600, 700)
- Code / mono:    **JetBrains Mono** (weights: 400, 500)

| Role           | Font          | Size  | Weight   | Class                                              |
|----------------|---------------|-------|----------|----------------------------------------------------|
| Page title     | Space Grotesk | 24px  | Bold     | `font-display text-2xl font-bold tracking-tight`   |
| Section heading| Inter         | 16px  | SemiBold | `text-base font-semibold`                          |
| Card title     | Inter         | 14px  | SemiBold | `text-sm font-semibold tracking-tight`             |
| Stat value     | Inter         | 28px  | Bold     | `text-3xl font-bold tracking-tight`                |
| Body text      | Inter         | 14px  | Regular  | `text-sm`                                          |
| Label / meta   | Inter         | 12px  | Medium   | `text-xs font-medium text-slate-500`               |
| Micro label    | Inter         | 10px  | Bold     | `text-[10px] font-bold uppercase tracking-[0.05em]`|
| Caption        | Inter         | 11px  | Regular  | `text-[11px] text-slate-400`                       |
| Mono / code    | JetBrains Mono| 12px  | Medium   | `font-mono text-xs font-medium`                    |

**Rule:** use `font-display` class (Space Grotesk) only for page-level `<h1>` titles. Everything else uses Inter via the default font stack.

---

## 3. LAYOUT SHELL

### Sidebar
```tsx
// 256px wide, fixed left, full height
<aside className="w-64 fixed left-0 top-0 h-full z-20
  bg-slate-100/40 dark:bg-slate-900/40
  backdrop-blur-[12px]
  border-r border-slate-200/60 dark:border-white/[0.05]">
```

### Topbar
```tsx
// 64px tall, sticky, z-30
<header className="h-16 sticky top-0 z-30
  bg-slate-50/80 dark:bg-[#030712]/80
  backdrop-blur-2xl
  border-b border-slate-200/60 dark:border-white/[0.05]">
```

### Main Content Area
```tsx
<main className="flex-1 p-4 md:p-8 bg-slate-50 dark:bg-transparent">
```

### Floating Notes FAB
```tsx
// Fixed bottom-right, 56px circle
<button className="fixed bottom-6 right-6 z-40
  w-14 h-14 rounded-full bg-blue-500
  shadow-2xl flex items-center justify-center">
```

---

## 4. SIDEBAR NAVIGATION

### Logo Area
```tsx
// 64px height, border-bottom
<div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-white/[0.05]">
  <div className="w-10 h-10 bg-white rounded-lg ring-1 ring-blue-500/20 flex items-center justify-center">
    {/* logo image */}
  </div>
  <span className="ml-3 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
    LeadCRM
  </span>
</div>
```

### Nav Item States
```tsx
// Base — all nav items share this
const navBase = "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors";

// Inactive
const navInactive = "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white";

// Active
const navActive = "bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20";
```

### Overdue Badge (Tasks nav item)
```tsx
<span className="ml-auto w-[18px] h-[18px] rounded-full bg-red-500
  text-white text-[10px] font-bold flex items-center justify-center">
  {overdueCount}
</span>
```

### Account Area (bottom)
```tsx
<div className="border-t border-gray-200 dark:border-white/[0.05] p-4 flex items-center gap-3">
  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center
    text-blue-500 text-sm font-semibold">
    {initials}
  </div>
  <div>
    <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
    <p className="text-xs text-slate-400">{role}</p>
  </div>
</div>
```

---

## 5. TOPBAR ELEMENTS

```tsx
// Role switcher pill
<div className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/[0.05]
  bg-gray-50 dark:bg-white/[0.02] px-3 py-1.5">
  <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">Role:</span>
  <select className="text-xs bg-transparent text-slate-700 dark:text-slate-300 outline-none">
    {/* options */}
  </select>
</div>

// Theme toggle / Notes / Bell — shared icon button shell
<button className="w-9 h-9 rounded-full flex items-center justify-center
  hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors relative">
  {/* icon 20px */}
</button>

// Notification dot badge
<span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />

// Notes amber bounce badge
<span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-bounce" />
```

---

## 6. CORE COMPONENTS

### Card (base)
```tsx
<div className="rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-white/[0.02]
  shadow-lg backdrop-blur-xl p-6">
```

### Stat Card
```tsx
<div className="rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl p-5
  hover:shadow-md transition-shadow">

  {/* Row 1: icon box + trend pill */}
  <div className="flex items-start justify-between mb-3">
    {/* Icon box: 44px, rounded-xl, bg color/10%, icon in brand color */}
    <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
      <Icon className="w-5 h-5 text-blue-500" />
    </div>
    {/* Trend pill */}
    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-500">
      <ArrowUpRight className="w-3 h-3" /> +12%
    </span>
  </div>

  {/* Row 2: label + value */}
  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
</div>
```

### Button Variants
```tsx
// Primary CTA
<button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700
  text-white text-sm font-semibold shadow-md shadow-blue-500/20
  active:scale-95 transition-all">

// Outline
<button className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-transparent text-slate-700 dark:text-slate-300
  text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors">

// Ghost
<button className="h-9 px-4 rounded-lg text-slate-700 dark:text-slate-300
  text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors">

// Destructive
<button className="h-9 px-4 rounded-lg bg-red-500 hover:bg-red-600
  text-white text-sm font-semibold active:scale-95 transition-all">
```

### Badge Variants
```tsx
// Default (blue)
<span className="rounded-full border border-blue-200 dark:border-blue-500/20
  bg-blue-600 text-white px-2.5 py-0.5 text-xs font-semibold">

// Success
<span className="rounded-full bg-emerald-500/10 border border-emerald-500/20
  text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-semibold">

// Danger
<span className="rounded-full bg-red-500/10 border border-red-500/20
  text-red-600 dark:text-red-400 px-2.5 py-0.5 text-xs font-semibold">

// Warning
<span className="rounded-full bg-amber-500/10 border border-amber-500/20
  text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-xs font-semibold">

// Neutral
<span className="rounded-full bg-slate-100 dark:bg-white/[0.08]
  text-slate-700 dark:text-slate-300 px-2.5 py-0.5 text-xs font-semibold">

// Priority (micro, uppercase)
// High:   bg-red-500/10   text-red-500   border-red-500/20
// Medium: bg-orange-500/10 text-orange-500 border-orange-500/20
// Low:    bg-blue-500/10  text-blue-500  border-blue-500/20
<span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]">
```

### Input
```tsx
<input className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08]
  bg-white dark:bg-white/[0.02] px-3 py-1
  text-sm text-slate-900 dark:text-white
  placeholder:text-slate-400
  focus:outline-none focus:border-blue-500
  transition-colors" />
```

### Table
```tsx
// Container
<div className="rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-slate-900 overflow-hidden">

  // Header row
  <thead>
    <tr className="bg-slate-50 dark:bg-white/[0.02]">
      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider
        text-slate-500 dark:text-slate-400">
    </tr>
  </thead>

  // Body rows
  <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
    <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
      <td className="px-6 py-3.5 text-sm text-slate-900 dark:text-white">
    </tr>
  </tbody>
</div>
```

---

## 7. SIDE SHEET / DRAWER

```tsx
// Backdrop
<div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

// Sheet container — slides from right
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
  className="fixed right-0 top-0 h-full z-50 w-full max-w-lg
    bg-white dark:bg-slate-900
    border-l border-gray-200 dark:border-white/[0.05]
    shadow-[0_0_50px_rgba(0,0,0,0.15)]
    flex flex-col">

  {/* Header */}
  <div className="px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]
    bg-slate-50/50 dark:bg-white/[0.01] flex items-center justify-between">
    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
      {title}
    </h2>
    <button className="w-9 h-9 rounded-xl flex items-center justify-center
      hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors">
      <X className="w-4 h-4 text-slate-500" />
    </button>
  </div>

  {/* Body */}
  <div className="flex-1 overflow-y-auto px-6 py-5">
    {children}
  </div>

  {/* Footer */}
  <div className="px-6 py-4 border-t border-gray-200 dark:border-white/[0.05]
    flex items-center justify-end gap-3">
    <button className="h-9 px-4 rounded-lg border ...">Cancel</button>
    <button className="h-9 px-4 rounded-xl bg-blue-600 ...">Save</button>
  </div>
</motion.div>
```

---

## 8. MODAL (centered)

```tsx
// Backdrop
<div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm
  flex items-center justify-center p-4">

  // Modal container
  <motion.div
    initial={{ opacity: 0, scale: 0.97, y: 8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.97, y: 8 }}
    transition={{ type: 'spring', damping: 30, stiffness: 280 }}
    className="w-full max-w-lg rounded-2xl
      bg-white dark:bg-slate-900
      border border-gray-200 dark:border-white/[0.05]
      shadow-2xl flex flex-col max-h-[90vh]">

    {/* Header */}
    <div className="px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]
      flex items-center justify-between">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>
      <button className="w-9 h-9 rounded-xl flex items-center justify-center
        hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors">
        <X className="w-4 h-4 text-slate-500" />
      </button>
    </div>

    {/* Body */}
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      {children}
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-200 dark:border-white/[0.05]
      flex items-center justify-end gap-3">
      <button className="...ghost...">Cancel</button>
      <button className="...primary CTA...">Confirm</button>
    </div>
  </motion.div>
</div>
```

---

## 9. DEAL KANBAN CARD

```tsx
<div className={cn(
  "rounded-xl border p-4 bg-white dark:bg-slate-950 cursor-grab",
  "hover:shadow-md hover:-translate-y-0.5 hover:border-blue-500/40",
  "transition-all duration-150",
  // Dragging state
  isDragging && "border-blue-500/50 ring-2 ring-blue-500/20 bg-blue-500/5 opacity-70",
  // Rotting: 14+ days old
  ageInDays >= 14 && "border-red-500/30 bg-red-500/5 dark:bg-red-500/5",
  // Aging: 7-14 days old
  ageInDays >= 7 && ageInDays < 14 && "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/5",
)}>
  {/* Title row */}
  <div className="flex items-start justify-between gap-2 mb-2">
    <GripVertical className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
    <p className="text-sm font-semibold text-slate-900 dark:text-white flex-1">{title}</p>
  </div>

  {/* Contact · Company */}
  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
    {contactName} · {companyName}
  </p>

  {/* Tags row */}
  <div className="flex items-center gap-1.5 flex-wrap mb-3">
    {/* Value tag */}
    <span className="flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-500/20
      bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <DollarSign className="w-3 h-3" /> {value}
    </span>
    {/* Priority tag */}
    <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]
      {priority === 'High' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
       priority === 'Medium' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
       'bg-blue-500/10 border-blue-500/20 text-blue-500'}">
      {priority}
    </span>
  </div>

  {/* Footer: close date + avatar */}
  <div className="flex items-center justify-between pt-2
    border-t border-gray-100 dark:border-white/[0.05]">
    <span className="text-[11px] text-slate-400">{closeDate}</span>
    <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center
      text-[9px] font-bold text-blue-500">
      {assigneeInitials}
    </div>
  </div>
</div>
```

---

## 10. EMPTY STATE

```tsx
<div className="rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-white/[0.02] shadow-xl backdrop-blur-xl
  p-8 md:p-12 flex flex-col items-center text-center">

  {/* Animated illustration */}
  <motion.div
    animate={{ y: [0, -6, 0] }}
    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
    <Icon className="w-8 h-8 text-blue-500" />
  </motion.div>

  <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
    {title}
  </h3>
  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mb-6">
    {description}
  </p>

  <div className="flex items-center gap-3">
    <button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white
      text-sm font-semibold shadow-[0_4px_20px_rgba(10,110,255,0.25)] active:scale-95 transition-all">
      {primaryAction}
    </button>
    {secondaryAction && (
      <button className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08]
        bg-gray-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 text-sm font-medium">
        {secondaryAction}
      </button>
    )}
  </div>
</div>
```

---

## 11. SKELETON LOADER

```tsx
// Skeleton shimmer keyframes (add to globals.css)
// @keyframes shimmer { from { transform: translateX(-100%) } to { transform: translateX(100%) } }

// Skeleton wrapper (same card shell)
<div className="rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-white/[0.02] shadow-lg p-6 overflow-hidden relative">

  {/* Text line */}
  <div className="h-4 rounded-full bg-slate-200 dark:bg-white/[0.1] mb-3 w-3/4 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent
      via-slate-300/60 dark:via-white/[0.05] to-transparent
      animate-[shimmer_1.8s_linear_infinite]" />
  </div>

  {/* Icon placeholder */}
  <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-white/[0.1] relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent
      via-slate-300/60 dark:via-white/[0.05] to-transparent
      animate-[shimmer_1.8s_linear_infinite]" />
  </div>
</div>
```

---

## 12. SCROLLBAR STYLE

Add to `src/index.css` or `globals.css`:

```css
/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #CBD5E1; /* slate-300 */
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover { background: #94A3B8; } /* slate-400 */

.dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); }
.dark ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); }
```

---

## 13. MOTION SPECS

**Side Sheet enter/exit:**
```ts
{ type: 'spring', damping: 25, stiffness: 200 }
// x: '100%' → 0 (enter) | 0 → '100%' (exit)
```

**Modal enter/exit:**
```ts
{ type: 'spring', damping: 30, stiffness: 280 }
// opacity + scale 0.97 + y 8px → normal
```

**Backdrop fade:**
```ts
{ duration: 0.15 }
// opacity: 0 → 1 (enter) | 1 → 0 (exit)
```

**Page content entry:**
```ts
initial={{ opacity: 0, y: 15 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4 }}
```

**Empty state float:**
```ts
animate={{ y: [0, -6, 0] }}
transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
```

**Deal card drop:**
```ts
// Use motion layoutId with spring
{ type: 'spring', damping: 26, stiffness: 180 }
```

**Button press:**
```
active:scale-95  (Tailwind) — all primary and destructive buttons
```

**Theme transition:**
```css
transition: background-color 300ms ease, color 300ms ease, border-color 300ms ease;
```

---

## 14. PAGE-LEVEL LAYOUT RULES

### Page Header Row (every page)
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="font-display text-2xl font-bold tracking-tight
      text-slate-900 dark:text-white">
      {pageTitle}
    </h1>
    {subtitle && (
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
    )}
  </div>
  <div className="flex items-center gap-3">
    {/* page-level action buttons */}
  </div>
</div>
```

### Dashboard Grid
- Row 1: 6 stat cards — `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4`
- Row 2: revenue chart (8 cols) + action center (4 cols) — `grid grid-cols-12 gap-4`
- Row 3: bar chart (4) + leaderboard (4) + donut chart (4) — `grid grid-cols-12 gap-4`

Charts config:
```tsx
// Area chart — Revenue Trend
// fill: url(#blueGradient), stroke: #3B82F6
// No vertical gridlines; horizontal gridlines: stroke="rgba(0,0,0,0.06)" strokeDasharray="4 4"

// Bar chart — dual bars
// Bar 1 (Revenue): fill="#3B82F6", radius={[4,4,0,0]}
// Bar 2 (Deals):   fill="#8B5CF6", radius={[4,4,0,0]}

// Donut — Pipeline Distribution
// <Pie innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
```

### Kanban Column
```tsx
<div className="min-w-[280px] rounded-2xl border border-gray-200 dark:border-white/[0.05]
  bg-white dark:bg-slate-950 flex flex-col">

  {/* Column header */}
  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]
    flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{stageName}</span>
      <span className="rounded-full bg-slate-100 dark:bg-white/[0.08]
        text-slate-500 dark:text-slate-400 px-2 py-0.5 text-xs font-semibold">
        {count}
      </span>
    </div>
    <span className="text-xs font-semibold text-emerald-500">{totalValue}</span>
  </div>

  {/* Drop zone body */}
  <div className={cn(
    "flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]",
    isOver && "border-2 border-dashed border-blue-400 rounded-xl bg-blue-500/5"
  )}>
    {/* deal cards */}
  </div>
</div>
```

### Form Section Grouping (inside drawers/modals)
```tsx
<div className="space-y-5">
  {/* Section label */}
  <p className="text-xs font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">
    {sectionName}
  </p>

  {/* 2-col grid for paired fields */}
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        Field Label
      </label>
      <input className="h-9 w-full rounded-md border ..." />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  </div>
</div>
```

---

## 15. STATUS BADGE COLOR MAP

Apply consistently everywhere status is shown:

| Status     | Classes                                                              |
|------------|----------------------------------------------------------------------|
| Hot        | `bg-red-500/10 border-red-500/20 text-red-500`                      |
| Warm       | `bg-amber-500/10 border-amber-500/20 text-amber-500`                |
| Cold       | `bg-blue-500/10 border-blue-500/20 text-blue-500`                   |
| Closed/Won | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500`          |
| Lost       | `bg-red-500/10 border-red-500/20 text-red-500`                      |
| Cancelled  | `bg-slate-500/10 border-slate-500/20 text-slate-500`                |
| Active     | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500`          |
| Inactive   | `bg-slate-500/10 border-slate-500/20 text-slate-500`                |
| Pending    | `bg-amber-500/10 border-amber-500/20 text-amber-500`                |
| In Progress| `bg-blue-500/10 border-blue-500/20 text-blue-500`                   |
| Completed  | `bg-emerald-500/10 border-emerald-500/20 text-emerald-500`          |

---

## 16. DEAL TABS (DealDetailsModal)

All 5 tabs — Overview, Activities, Tasks, History, Automation — use this tab shell:

```tsx
<div className="flex border-b border-gray-200 dark:border-white/[0.05] px-6">
  {tabs.map(tab => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
        activeTab === tab.id
          ? "border-blue-500 text-blue-500"
          : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      )}>
      {tab.label}
    </button>
  ))}
</div>
```

---

## 17. DESIGN SYSTEM VALIDATION CHECKLIST

Before marking any UI task complete, verify:

- [ ] Colors use exact token classes from Section 1 — no hardcoded hex values in JSX
- [ ] Typography matches the scale in Section 2 — page titles use `font-display`
- [ ] Every card uses `rounded-2xl border ... bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl`
- [ ] Every modal uses spring animation `{ damping: 30, stiffness: 280 }` with backdrop blur
- [ ] Every drawer slides from right with spring `{ damping: 25, stiffness: 200 }`
- [ ] Animations import from `motion/react` — never `framer-motion`
- [ ] Status badges use the exact color map from Section 15 — no ad-hoc colors
- [ ] Priority badges are micro-label style: `text-[10px] font-bold uppercase tracking-[0.05em]`
- [ ] Buttons: primary uses `rounded-xl`, outlines use `rounded-lg`
- [ ] Every button has `active:scale-95` for tactile feedback
- [ ] Dark mode classes present on every element — no light-only components
- [ ] Form fields: label above, error message below, `h-9` input height
- [ ] Kanban column drop zone shows blue dashed highlight on drag-over
- [ ] Deal cards show aging (amber) / rotting (red) border tints when applicable
- [ ] Empty state icon animated with float `y: [0, -6, 0]` loop
- [ ] Scrollbar style applied globally (Section 12)
- [ ] No inline `style={{}}` — Tailwind classes only
- [ ] Page header matches the layout in Section 14 with `font-display` h1
