/**
 * Runtime validation for Module_Config objects.
 * Called at component initialization time to catch programmer errors early.
 * Invalid configs are a development-time concern, not a runtime user error.
 */

import type { ModuleConfig } from '@leadcrm/shared';

export function validateModuleConfig(config: ModuleConfig): void {
  if (!config.moduleId || config.moduleId.trim() === '') {
    throw new Error('[Data_View_System] Module_Config rejected: moduleId is empty');
  }
  if (!config.columnRegistry || config.columnRegistry.length === 0) {
    throw new Error('[Data_View_System] Module_Config rejected: columnRegistry is empty');
  }
  if (!config.availableViews || config.availableViews.length === 0) {
    throw new Error('[Data_View_System] Module_Config rejected: availableViews is empty');
  }

  // Dev-time warning: validate kanbanGroupingField references a valid column ID
  if (config.kanbanGroupingField) {
    const columnIds = new Set(config.columnRegistry.map((col) => col.id));
    if (!columnIds.has(config.kanbanGroupingField)) {
      console.warn(
        `[Data_View_System] Module "${config.moduleId}": kanbanGroupingField ` +
          `"${config.kanbanGroupingField}" does not reference a valid column ID in the registry. ` +
          `Available IDs: ${[...columnIds].join(', ')}`
      );
    }
  }
}
