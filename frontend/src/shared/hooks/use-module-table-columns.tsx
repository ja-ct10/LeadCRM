'use client';

import { useRef, useState } from 'react';
import type { ColumnDefinition } from '@leadcrm/shared';
import { reconcileTableColumns } from '@leadcrm/shared';
import { toast } from 'sonner';
import type { DataGridColumnDef } from '@/shared/components/data-grid';
import { ManageColumnsDrawer } from '@/shared/components/manage-columns-drawer';
import { useColumnPreferences } from './use-column-preferences';
import { getTableSortFields } from '@/shared/constants/column-registries';

export function useModuleTableColumns<T>(module: string, registry: ColumnDefinition[], columns: DataGridColumnDef<T>[]) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { effectiveColumns, saveColumns, resetColumns, resetColumnWidths, saveColumnWidth } = useColumnPreferences(module);
  const config = reconcileTableColumns(module, effectiveColumns, registry);
  const availableRegistry = registry.filter(definition => columns.some(column => column.id === definition.id));
  const saveAvailableColumns = (draft: import('@leadcrm/shared').ColumnConfigItem[]) => {
    const availableIds = new Set(draft.map(column => column.id));
    let index = 0;
    return saveColumns(config.map(column => availableIds.has(column.id) ? draft[index++] : column)
      .map((column, order) => ({ ...column, order })));
  };
  const visibleColumns = [...config].sort((a, b) => a.order - b.order)
    .filter(col => col.visible || registry.some(item => item.id === col.id && item.required))
    .flatMap(col => { const definition = columns.find(item => item.id === col.id); return definition ? [{ ...definition, width: col.width ?? definition.width }] : []; });
  const onColumnWidthChange = (id: string, width: number) => { void saveColumnWidth(id, width).catch(() => toast.error('Unable to save column width. Please try again.')); };
  return { columns: visibleColumns.map(column => ({ ...column, resizable: column.resizable ?? true, pinned: registry.find(item => item.id === column.id)?.pinned ?? column.pinned })), sortFields: getTableSortFields(module), resetColumnWidths, onColumnWidthChange, openColumns: () => { triggerRef.current = document.activeElement as HTMLElement; setOpen(true); }, drawer: <ManageColumnsDrawer
    isOpen={open} onClose={() => setOpen(false)} module={module} registry={availableRegistry}
    effectiveColumns={config} onSave={saveAvailableColumns} onReset={resetColumns} triggerRef={triggerRef} /> };
}
