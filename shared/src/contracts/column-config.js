"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileTableColumns = reconcileTableColumns;
const module_table_columns_1 = require("./module-table-columns");
/** Same presentation rules for user/tenant reads, defaults, drawers and grids. */
function reconcileTableColumns(module, columns, registry) {
    const normalized = (0, module_table_columns_1.normalizeModuleColumns)(module, columns);
    const definitions = new Map(registry.map(column => [column.id, column]));
    const seen = new Set();
    const ordered = [...normalized].sort((a, b) => a.order - b.order).filter(column => {
        if (!definitions.has(column.id) || seen.has(column.id))
            return false;
        seen.add(column.id);
        return true;
    });
    // Append missing optional fields without disturbing the saved sequence.
    for (const definition of [...registry].sort((a, b) => a.defaultOrder - b.defaultOrder)) {
        if (!seen.has(definition.id))
            ordered.push({ id: definition.id, visible: definition.defaultVisible, order: ordered.length });
    }
    const fixed = ordered.filter(column => definitions.get(column.id)?.fixedPosition === 'first');
    const movable = ordered.filter(column => definitions.get(column.id)?.fixedPosition !== 'first');
    return [...fixed, ...movable].map((column, order) => ({
        ...column, order, visible: definitions.get(column.id)?.required ? true : column.visible,
    }));
}
