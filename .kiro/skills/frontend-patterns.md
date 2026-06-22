---
name: frontend-patterns
description: React + TypeScript + ShadCN + TailwindV4 UI patterns for LeadCRM — use before writing any component, filter, form, or UI code
---

# Frontend Patterns for LeadCRM

## Component Structure
- Props: always define with a named `interface` — never use `any`
- Keep components under 400 lines — split into smaller pieces if larger
- One component per file — no multiple exports from one file unless they are tightly related

```tsx
interface ContactCardProps {
  contact: Contact;
  onEdit: (id: string) => void;
}
export function ContactCard({ contact, onEdit }: ContactCardProps) { ... }
```

## ShadCN UI Rules
- Use components from `src/components/ui/` — Button, Badge, Card, Input, Label, Separator
- Use `cn()` from `src/lib/utils.ts` for conditional class merging — never string concatenation
- Match existing visual style: `rounded-2xl`, `border border-gray-200 dark:border-white/[0.05]`, `backdrop-blur-xl`

## Filter Pattern — MANDATORY
- ALWAYS use `<TrelloFilter>` from `src/components/TrelloFilter.tsx` — never raw `<select>`
- Filter button label = "Filter" always
- Smart Views = radio buttons (single select, `selectedView: string`)
- Status / Members / Labels / Category = checkboxes (multi-select, `selectedX: string[]`)
- Filter state must be `string[]` for multi-select, never `string`

```tsx
// CORRECT filter state
const [statusFilter, setStatusFilter] = useState<string[]>([]);

// CORRECT filter logic
const filtered = items.filter(item =>
  statusFilter.length === 0 || statusFilter.includes(item.status)
);
```

## Charts — MANDATORY
- ALWAYS import from `src/components/charts/ChartComponents.tsx`
- NEVER import from `recharts` directly
- Available: `BarChart`, `AreaChart`, `LineChart`, `PieChart`, `ResponsiveContainer`, `Bar`, `Area`, `Line`, `Pie`, `Cell`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`

## Form Pattern
- Use controlled inputs with `useState` + `setFormData` spread pattern
- Validate on submit AND on blur for required fields
- Show errors below the field, not as alerts
- Use `sonner` toast for success/error notifications — `toast.success()` / `toast.error()`

## Animation
- Import from `'motion/react'` — NEVER from `'framer-motion'`
- Use `<motion.div>` + `<AnimatePresence>` for enter/exit animations
- Keep animations subtle: `initial={{ opacity: 0 }}` + `animate={{ opacity: 1 }}`

## Infinite Loop Prevention
- Never put entire arrays from Context (organizations, users, deals) in `useEffect` deps
- Use `useRef` to hold Context arrays when needed inside effects
- `useEffect(() => {...}, [initialData, initialData?.id])` — use specific ID, not whole array

## Dark Mode Pattern
- All elements need both light and dark classes:
  - Background: `bg-white dark:bg-white/[0.02]`
  - Text: `text-slate-900 dark:text-white`
  - Border: `border-gray-200 dark:border-white/[0.05]`
  - Subtle text: `text-slate-500 dark:text-slate-400`

## RBAC Permission Guards
- Before showing UI for create/edit/delete, always check:
```tsx
const userRoleDef = roles.find(r => r.name === user?.role);
const userPerms = userRoleDef?.permissions || [];
const canCreate = user?.role === 'Client Admin' || userPerms.includes('pXX');
{canCreate && <button>...</button>}
```
