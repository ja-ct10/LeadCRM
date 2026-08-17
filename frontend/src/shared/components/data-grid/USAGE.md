# DataGrid — Usage Guide

## Overview

The `DataGrid` component is a modern, reusable data-grid for LeadCRM that provides:

- **Sticky header** pinned during vertical scroll
- **Pinned columns** (checkbox + primary column stay visible during horizontal scroll)
- **Resizable columns** via drag handles
- **Multi-column sorting** via header click (asc → desc → none cycle)
- **Bulk selection** with select-all and indeterminate state
- **Quick-action icons** (inline on hover, don't trigger row selection)
- **Summary/calculation footer** (sticky at bottom)
- **Dark mode** support
- **Full accessibility** (ARIA grid pattern)

## Quick Start

```tsx
import { DataGrid, useDataGridColumns, DataGridQuickFilter } from '@/shared/components/data-grid';
import type { DataGridColumnDef } from '@/shared/components/data-grid';
import { useColumnPreferences } from '@/shared/hooks/use-column-preferences';
import { useTablePreferences } from '@/shared/hooks/use-table-preferences';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';

function LeadsDataGrid({ leads }: { leads: Lead[] }) {
  // Existing preference hooks — unchanged
  const { effectiveColumns } = useColumnPreferences('leads');
  const { sort, setSort } = useTablePreferences('leads');

  // Bridge hook → converts preferences to DataGrid column defs
  const { gridColumns } = useDataGridColumns<Lead>({
    registry: LEADS_COLUMN_REGISTRY,
    effectiveColumns,
    cellRenderers: {
      firstName: (_, row) => <NameCell lead={row} />,
      status: (value) => <StatusBadge label={String(value)} />,
    },
    pinnedColumns: ['firstName'],
    sortableColumns: ['firstName', 'status', 'createdAt', 'source'],
  });

  return (
    <DataGrid
      columns={gridColumns}
      data={leads}
      getRowId={(lead) => lead.id}
      height={600}
      selectable
      sort={sort}
      onSortChange={setSort}
      onRowClick={(lead) => openDrawer(lead)}
      quickActions={[
        { id: 'call', label: 'Call', icon: <Phone size={14} />, onClick: handleCall },
        { id: 'email', label: 'Email', icon: <Mail size={14} />, onClick: handleEmail },
      ]}
      summaryLabel={`${leads.length} records`}
    />
  );
}
```

## Registering New Columns

Define column definitions in your module's column registry:

```ts
// shared/constants/column-registries.ts
export const MY_MODULE_COLUMN_REGISTRY: ColumnDefinition[] = [
  { id: 'name',    label: 'Name',    required: true,  defaultVisible: true,  defaultOrder: 0, priority: 'required' },
  { id: 'status',  label: 'Status',  required: false, defaultVisible: true,  defaultOrder: 1, priority: 'medium' },
  { id: 'email',   label: 'Email',   required: false, defaultVisible: true,  defaultOrder: 2, priority: 'low' },
  { id: 'created', label: 'Created', required: false, defaultVisible: false, defaultOrder: 3, priority: 'low' },
];
```

Then provide custom cell renderers in the `cellRenderers` map:

```ts
const { gridColumns } = useDataGridColumns({
  registry: MY_MODULE_COLUMN_REGISTRY,
  effectiveColumns,
  cellRenderers: {
    name: (value, row) => (
      <div className="flex items-center gap-2">
        <Avatar name={String(value)} />
        <span className="font-medium">{String(value)}</span>
      </div>
    ),
    status: (value) => <StatusBadge label={String(value)} variant={getVariant(value)} />,
    created: (value) => <span>{formatDate(String(value))}</span>,
  },
});
```

## Custom Cell Formatters

The `cell` render function receives:
- `value` — the accessor output for this cell
- `row` — the full record object
- `context` — grid-level utilities (helpers map, isSelected, rowIndex)

```ts
const columns: DataGridColumnDef<Deal>[] = [
  {
    id: 'value',
    header: 'Deal Value',
    accessor: (row) => row.value,
    cell: (value, row) => (
      <div className="text-right font-bold">
        {formatCurrency(Number(value))}
        <span className="text-[9px] text-slate-400 block">
          {row.currency}
        </span>
      </div>
    ),
    align: 'right',
    sortable: true,
    resizable: true,
    width: 120,
  },
];
```

## Pinned Columns

Pin columns to the left for critical identifier fields:

```ts
const { gridColumns } = useDataGridColumns({
  // ...
  pinnedColumns: ['firstName'],  // stays visible during horizontal scroll
});
```

Or directly in manual column defs:

```ts
{ id: 'name', pinned: 'left', ... }
```

## Column Resizing

Enabled by default for all columns. To restrict:

```ts
const { gridColumns } = useDataGridColumns({
  resizableColumns: ['name', 'email', 'status'],  // only these are resizable
});
```

For controlled widths (e.g., server-persisted):

```tsx
const [widths, setWidths] = useState<Record<string, number>>({});

<DataGrid
  columnWidths={widths}
  onColumnResize={(colId, width) => setWidths(prev => ({ ...prev, [colId]: width }))}
/>
```

## Quick Actions

Inline action buttons appear on row hover without triggering row click:

```tsx
<DataGrid
  quickActions={[
    { id: 'call', label: 'Call', icon: <Phone size={14} />, onClick: (lead) => initiateCall(lead.phone) },
    { id: 'star', label: 'Star', icon: <Star size={14} />, onClick: (lead) => toggleStar(lead.id) },
    { id: 'email', label: 'Email', icon: <Mail size={14} />, onClick: (lead) => openEmailCompose(lead.email) },
  ]}
/>
```

Conditional visibility:

```ts
{ id: 'call', visible: (lead) => Boolean(lead.phone), ... }
```

## Summary Footer

Show aggregated data in a sticky bottom bar:

```tsx
<DataGrid
  summaryLabel={`${totalRecords} total records`}
  summaryColumns={[
    { columnId: 'value', content: <span>Total: {formatCurrency(totalValue)}</span> },
    { columnId: 'probability', content: <span>Avg: {avgProbability}%</span> },
  ]}
/>
```

## Multi-View Architecture Integration

The DataGrid is designed to work alongside List/Kanban views. Sorting and filtering
state lives in the parent (via `useTablePreferences`), so view switching retains state:

```tsx
const { sort, setSort, viewMode } = useTablePreferences('leads');
const [activeView, setActiveView] = useState<'table' | 'list' | 'kanban'>('table');

// State is shared — switching views preserves filter/sort
{activeView === 'table' && (
  <DataGrid columns={gridColumns} data={filteredLeads} sort={sort} onSortChange={setSort} ... />
)}
{activeView === 'list' && (
  <CompactListView data={filteredLeads} sort={sort} ... />
)}
{activeView === 'kanban' && (
  <KanbanView data={filteredLeads} ... />
)}
```

## Component Architecture

```
data-grid/
├── data-grid.tsx            — Main DataGrid component (table engine)
├── data-grid-quick-filter.tsx — Quick filter search bar
├── use-column-resize.ts     — Resize handle pointer event logic
├── use-data-grid-sort.ts    — Sort state management + comparator
├── use-bulk-selection.ts    — Selection state (controlled/uncontrolled)
├── use-data-grid-columns.ts — Bridge: preference system → DataGridColumnDef[]
├── types.ts                 — All type definitions
├── index.ts                 — Public barrel exports
└── USAGE.md                 — This file
```

## Integration with Existing Preferences

The DataGrid **does not replace** the existing column preference system. Instead:

1. `useColumnPreferences('module')` — fetches server-backed column visibility/order
2. `useTablePreferences('module')` — fetches sort/pageSize/viewMode
3. `useDataGridColumns()` — converts the above into `DataGridColumnDef[]`
4. `DataGrid` — renders the final data grid

The `ManageColumnsDrawer` continues to control visibility/order. The DataGrid just
renders whatever columns are marked visible.

## Accessibility

- Full ARIA grid pattern (`role="grid"`, `role="row"`, `aria-sort`, `aria-selected`)
- Keyboard-accessible checkboxes and action buttons
- Screen reader labels on all interactive elements
- `aria-label` on the grid region
- Indeterminate checkbox state for partial selection
