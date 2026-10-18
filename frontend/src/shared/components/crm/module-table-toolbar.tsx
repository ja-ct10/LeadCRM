'use client';

import type { ReactNode } from 'react';
import type { RecordSort, TableSortOption } from '@leadcrm/shared';
import { ModuleSearchInput } from './module-search-input';
import { RefreshButton } from './refresh-button';
import { TableSettingsMenu } from './table-settings-menu';

/** The Leads control layout for standalone module tables and lists. */
export function ModuleTableToolbar({ search, onSearch, placeholder, label, filter, beforeRefresh, refreshing, onRefresh, onManageColumns, onResetColumnSize, disabled, sort, sortFields, onSortChange, stackSearchOnMobile = false }: {
  search: string; onSearch: (value: string) => void; placeholder: string; label: string;
  filter?: ReactNode; beforeRefresh?: ReactNode; refreshing?: boolean; onRefresh: () => void | Promise<unknown>;
  onManageColumns?: () => void; disabled?: boolean; silentRefresh?: boolean;
  onResetColumnSize?: () => void | Promise<unknown>;
  sort?: RecordSort | null; sortFields?: TableSortOption[]; onSortChange?: (sort: RecordSort | null) => void;
  stackSearchOnMobile?: boolean;
}) {
  const searchInput = <ModuleSearchInput value={search} onChange={onSearch} placeholder={placeholder} label={`Search ${label.toLowerCase()}`} disabled={disabled} />;
  const actions = <div className="ml-auto flex shrink-0 items-center gap-2 sm:order-1">
    {beforeRefresh}
    <RefreshButton onClick={onRefresh} disabled={disabled} refreshing={refreshing} />
    <TableSettingsMenu onManageColumns={onManageColumns} onResetColumnSize={onResetColumnSize} sort={sort} sortFields={sortFields} onSortChange={onSortChange} />
  </div>;

  return <div data-selection-toolbar role="toolbar" aria-label={`${label} controls`} className="flex min-w-0 flex-wrap items-center gap-2">
    {stackSearchOnMobile ? <>
      <div className="w-full min-w-0 sm:w-auto sm:flex-none">{searchInput}</div>
      <div role="group" aria-label={`${label} actions`} className="flex w-full min-w-0 items-center justify-between gap-2 sm:contents">
        {filter}
        {actions}
      </div>
    </> : <>
      <div role="group" aria-label={`${label} search and refresh`} className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:contents">
        <div className="min-w-0 flex-1 sm:flex-none">{searchInput}</div>
        {actions}
      </div>
      {filter}
    </>}
  </div>;
}
