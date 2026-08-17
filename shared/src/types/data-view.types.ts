/**
 * Data View types — shared between frontend and backend.
 * Defines the Module_Config interface and related types for the
 * Unified Data Views system.
 */

import type { ColumnConfigItem, ColumnDefinition } from './preferences';

// ─── View Types ──────────────────────────────────────────────────────────────

export type ViewType = 'table' | 'list' | 'grid' | 'tile' | 'kanban';

// ─── Filter Contract ─────────────────────────────────────────────────────────

export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'is_null'
  | 'is_not_null';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

// ─── Module Config Building Blocks ───────────────────────────────────────────

export interface SortableFieldDef {
  id: string;
  label: string;
}

export interface FilterItemDef {
  id: string;
  label: string;
}

export interface FilterGroupDef {
  id: string;
  label: string;
  items: FilterItemDef[];
}

export interface RowActionDef {
  id: string;
  label: string;
}

export interface BulkActionDef {
  id: string;
  label: string;
  destructive: boolean;
}

// ─── Module Config ───────────────────────────────────────────────────────────

export interface ModuleConfig {
  moduleId: string;
  columnRegistry: ColumnDefinition[];
  /** Tuple type ensures at least one view is available. */
  availableViews: [ViewType, ...ViewType[]];
  sortableFields?: SortableFieldDef[];
  filterGroups?: FilterGroupDef[];
  rowActions?: RowActionDef[];
  bulkActions?: BulkActionDef[];
  kanbanGroupingField?: string;
}

// ─── Server-Side Data Fetching Contract ──────────────────────────────────────

export interface ModuleDataFetchParams {
  page: number;
  pageSize: number;
  sort?: string;
  filter?: FilterCondition[];
  search?: string;
}

/**
 * Paginated response shape for module data fetching.
 * Uses `pageSize` / `totalPages` semantics aligned with the Data View system.
 * (Distinguished from the generic `PaginatedResponse` in api.types.ts which
 * uses `limit` / `hasMore` semantics.)
 */
export interface ModulePaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ─── View Rendering ──────────────────────────────────────────────────────────

export type ViewMode = 'wrap' | 'clip';

export interface ViewRendererProps {
  data: Record<string, unknown>[];
  columns: ColumnConfigItem[];
  columnRegistry: ColumnDefinition[];
  viewMode: ViewMode;
  onRowClick?: (recordId: string) => void;
  onRowSelect?: (recordId: string, selected: boolean) => void;
  selectedIds?: Set<string>;
  isLoading?: boolean;
}
