/**
 * Column preference types — shared between frontend and backend.
 * Defines the data structures for column configuration persistence.
 */

/** A single column's configuration state (visibility + order). */
export interface ColumnConfigItem {
  id: string;
  visible: boolean;
  order: number;
}

/** Full column configuration for a module/view. */
export interface ColumnConfig {
  module: string;
  view?: string;
  columns: ColumnConfigItem[];
}

/** Column metadata from the registry — defines available columns per module. */
export interface ColumnDefinition {
  id: string;
  label: string;
  required: boolean;
  defaultVisible: boolean;
  defaultOrder: number;
}
