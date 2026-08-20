/**
 * Column preference types — shared between frontend and backend.
 * Defines the data structures for column configuration persistence.
 */

/** A single column's configuration state (visibility + order + optional width). */
export interface ColumnConfigItem {
  id: string;
  visible: boolean;
  order: number;
  /** Persisted column width in pixels (optional — omitted means use default). */
  width?: number;
}

/** Full column configuration for a module/view. */
export interface ColumnConfig {
  module: string;
  view?: string;
  columns: ColumnConfigItem[];
}

/** Responsive priority — determines hide order as viewport narrows. */
export type ColumnPriority = 'required' | 'high' | 'medium' | 'low';

/** Column metadata from the registry — defines available columns per module. */
export interface ColumnDefinition {
  id: string;
  label: string;
  required: boolean;
  defaultVisible: boolean;
  defaultOrder: number;
  /** Optional category group for display in Manage Columns drawer. */
  group?: string;
  /** Responsive priority — determines hide order as viewport narrows. */
  priority: ColumnPriority;
}
