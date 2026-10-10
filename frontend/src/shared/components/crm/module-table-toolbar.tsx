'use client';

import type { ReactNode } from 'react';
import { ModuleSearchInput } from './module-search-input';
import { RefreshButton } from './refresh-button';
import { ManageColumnsButton } from './manage-columns-button';

/** The Leads control layout for standalone module tables and lists. */
export function ModuleTableToolbar({ search, onSearch, placeholder, label, filter, refreshing, onRefresh, onManageColumns, disabled, silentRefresh }: {
  search: string; onSearch: (value: string) => void; placeholder: string; label: string;
  filter?: ReactNode; refreshing?: boolean; onRefresh: () => void | Promise<unknown>;
  onManageColumns?: () => void; disabled?: boolean; silentRefresh?: boolean;
}) {
  return <div data-selection-toolbar role="toolbar" aria-label={`${label} controls`} className="flex min-w-0 flex-wrap items-center gap-2">
    <ModuleSearchInput value={search} onChange={onSearch} placeholder={placeholder} label={`Search ${label.toLowerCase()}`} disabled={disabled} />
    {filter}
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <RefreshButton onClick={onRefresh} disabled={disabled} refreshing={refreshing} silent={silentRefresh} />
      {onManageColumns && <ManageColumnsButton onClick={onManageColumns} />}
    </div>
  </div>;
}
