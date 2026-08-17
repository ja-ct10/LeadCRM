/**
 * VIEW_OPTIONS registry — maps ViewType to its corresponding View Renderer component.
 *
 * New view types are added by registering a component here and passing the
 * new view type in a module's `availableViews` array. No changes to
 * ModuleWorkspace source code are required.
 */

import type { ComponentType } from 'react';
import type {
  ViewType,
  ViewRendererProps,
} from '@leadcrm/shared';

import { TableViewRenderer } from './view-renderers/table-view-renderer';
import { ListViewRenderer } from './view-renderers/list-view-renderer';
import { GridViewRenderer } from './view-renderers/grid-view-renderer';
import { TileViewRenderer } from './view-renderers/tile-view-renderer';
import { KanbanViewRenderer } from './view-renderers/kanban-view-renderer';

// Re-export ViewRendererProps for convenience — consumers can import from here
// without needing to know the shared package structure.
export type { ViewRendererProps } from '@leadcrm/shared';

// ─── VIEW_OPTIONS Registry ───────────────────────────────────────────────────

export const VIEW_OPTIONS: Record<ViewType, ComponentType<ViewRendererProps>> = {
  table: TableViewRenderer,
  list: ListViewRenderer,
  grid: GridViewRenderer,
  tile: TileViewRenderer,
  kanban: KanbanViewRenderer as ComponentType<ViewRendererProps>,
};
