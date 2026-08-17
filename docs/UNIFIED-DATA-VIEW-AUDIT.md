# LeadCRM Unified Data View & CRM Module Audit

## Executive Summary

**Overall Assessment:** 🟠 NEEDS MAJOR FIXES

The Unified Data View System architecture is well-designed and ~70% implemented. The core infrastructure (column registries, preference hooks, ManageColumnsDrawer, DataGrid component, VIEW_OPTIONS registry) is solid. However, critical gaps remain in module consistency, responsive column strategy, bulk selection enforcement, server-side data fetching, and the Deals module migration.

| Metric | Count |
|--------|-------|
| 🔴 HIGH RISK | 8 |
| 🟠 MEDIUM RISK | 14 |
| 🟢 LOW RISK | 9 |
| ✅ PASS | 5 |
| ⚠️ PARTIAL | 8 |
| ❌ FAIL | 2 |
| 🚫 NOT IMPLEMENTED | 1 |

**Most Critical Blockers:**
1. Deals module not migrated to shared DataGrid (module inconsistency)
2. No 100-record selection cap enforced in `useBulkSelection`
3. Client-side sorting/filtering instead of server-side (contradicts design.md)
4. Responsive Column Strategy (`use-responsive-columns.ts`) not implemented
5. `priority` field is optional in shared types (should be required per spec)

---

## 1. Risk Summary

| ID | Risk | Severity | Module | Area | Status |
|----|------|----------|--------|------|--------|
| R01 | Selection cap at 100 not enforced | 🔴 HIGH | All | Bulk Selection | Missing |
| R02 | Client-side sort/filter instead of server-side | 🔴 HIGH | Leads/Contacts/Accounts | Data Fetching | Contradicts spec |
| R03 | Deals module not using shared DataGrid | 🔴 HIGH | Deals | Consistency | Missing |
| R04 | Responsive Column Strategy not implemented | 🔴 HIGH | All | Responsive | Missing |
| R05 | `priority` field optional in ColumnDefinition | 🔴 HIGH | Shared | Type Safety | Partial |
| R06 | No pagination reset on sort/filter change (Contacts/Accounts) | 🔴 HIGH | Contacts/Accounts | Pagination | Missing |
| R07 | Table preferences API routes not on backend routes file | 🔴 HIGH | Backend | API | 🔍 Needs Verification |
| R08 | Column validation regex rejects `camelCase` IDs with capitals | 🔴 HIGH | Shared/Backend | Validation | Bug |
| R09 | Leads module uses feature-local ManageColumnsDrawer import | 🟠 MEDIUM | Leads | Architecture | Inconsistency |
| R10 | View type preference not used in Leads/Contacts/Accounts pages | 🟠 MEDIUM | All except MW | Preferences | Partial |
| R11 | No view-mode (wrap/clip) applied to DataGrid cells | 🟠 MEDIUM | All | Display | Missing |
| R12 | Kanban view lacks Module_Config integration | 🟠 MEDIUM | Leads | Views | Partial |
| R13 | Selection not preserved across pages | 🟠 MEDIUM | Leads | Bulk Selection | Missing |
| R14 | ManageColumnsDrawer has no keyboard-accessible reorder labels | 🟠 MEDIUM | All | Accessibility | Partial |
| R15 | Pagination in DataGrid footer absent | 🟠 MEDIUM | All | Pagination | Missing |
| R16 | Empty state in DataGrid doesn't include clear-filters action | 🟠 MEDIUM | All | UX | Partial |
| R17 | Sort stale preference handling missing | 🟠 MEDIUM | All | Sort | Missing |
| R18 | useTablePreferences doesn't persist sort=null on clear | 🟠 MEDIUM | All | Sort | Missing |
| R19 | PAGE_SIZE_OPTIONS in ModuleWorkspace missing 25 | 🟠 MEDIUM | All | Pagination | Bug |
| R20 | Module_Config not used by Leads/Contacts/Accounts pages | 🟠 MEDIUM | All | Architecture | Partial |
| R21 | Deals module no column preference integration in table | 🟠 MEDIUM | Deals | Columns | Missing |
| R22 | No filter persistence (saved filters) | 🟠 MEDIUM | All | Preferences | Missing |
| R23 | Leads page exceeds 400-line component limit (946 lines) | 🟢 LOW | Leads | Code Quality | Violation |
| R24 | ModuleWorkspace exceeds 400-line limit (1057 lines) | 🟢 LOW | Shared | Code Quality | Violation |
| R25 | `organizations: any[]` in LeadDrawerOverview props | 🟢 LOW | Leads | Type Safety | Violation |
| R26 | Dead code: `selectedIds` array in Leads (separate from Set) | 🟢 LOW | Leads | Code Quality | Minor |
| R27 | Missing aria-labels on some filter checkboxes | 🟢 LOW | All | Accessibility | Minor |
| R28 | Grid/Tile/Kanban views not paginated in Leads | 🟢 LOW | Leads | Pagination | Inconsistency |
| R29 | Default page size inconsistency (useTablePreferences=25, ModuleWorkspace prop=10) | 🟢 LOW | All | Defaults | Bug |
| R30 | No column width persistence in preferences API | 🟢 LOW | All | Persistence | Not specified |
| R31 | Backend `ColumnItemSchema` regex `^[a-zA-Z0-9]+$` rejects `camelCase` with digits but allows it; however rejects IDs with hyphens/underscores | 🟢 LOW | Backend | Validation | Minor |

---

## 2. Requirements Compliance Matrix

| Requirement | Status | Evidence | Risk | Recommendation |
|-------------|--------|----------|------|----------------|
| **R1: Unified Data Configuration Registry** | ⚠️ PARTIAL | `data-view.types.ts` defines `ModuleConfig`, `view-registry.ts` has VIEW_OPTIONS, `validate-module-config.ts` exists. BUT: modules don't pass moduleConfig prop to ModuleWorkspace yet (legacy children path used); `priority` field is optional in type definition. | 🔴 | Make `priority` required in ColumnDefinition. Have modules pass moduleConfig to ModuleWorkspace. |
| **R2: Multi-View Rendering** | ⚠️ PARTIAL | Leads has all 5 views. ModuleWorkspace supports view switching. View switching preserves filters/sort. BUT: view switch triggers no new API call (correct per spec for client-side, BUT spec says server-side). Contacts/Accounts missing Kanban. Deals on legacy table. | 🟠 | Migrate Deals. Add Kanban to Contacts/Accounts where applicable. |
| **R3: Standardized Table Layout** | ✅ PASS | DataGrid uses HEADER_HEIGHT=44, ROW_HEIGHT_NORMAL=52, ROW_HEIGHT_DENSE=44, correct colors, checkbox sizing 14×14 (w-3.5 h-3.5), rounded-xl container, border colors match spec. | — | Maintain current implementation. |
| **R4: Responsive Layout and Column Priority** | ❌ FAIL | `use-responsive-columns.ts` hook does NOT exist in codebase. No responsive column hiding logic found. Horizontal scroll works via `overflow-auto` on the grid container. Sticky header works. Viewport zoom behavior unverified. | 🔴 | Implement `computeVisibleColumns` per design.md and integrate into DataGrid. |
| **R5: Column Drag-and-Drop Reordering** | ✅ PASS | ManageColumnsDrawer uses @dnd-kit with 5px PointerSensor threshold, KeyboardSensor with sortableKeyboardCoordinates, sequential 0-based order reassignment after drop, manual save button, rollback on failure, retry limit at 3. | — | Well implemented. |
| **R6: Server-Persisted Preferences** | ⚠️ PARTIAL | Column prefs: manual save ✅. Table prefs (sort, pageSize, viewMode): fire-and-forget ✅. View type: fire-and-forget ✅. Filter persistence: NOT implemented (URL sync only). Timeout fallback: not implemented. Reconciliation: works. | 🟠 | Implement filter persistence and 5s timeout fallback. |
| **R7: Module-Specific Column Configuration** | ✅ PASS | 4 modules registered with separate registries. Required columns locked in drawer. Filter groups defined per module. Row actions per module. Adding new module requires only registry + config. | — | Working correctly. |
| **R8: Reusable ManageColumnsDrawer** | ✅ PASS | Accepts module + registry, groups columns by `group` field, search filters columns, lock icon on required, reset confirmation dialog, unsaved changes dialog, retry exhaustion at 3. | — | Solid implementation. |
| **R9: Loading and Empty States** | ⚠️ PARTIAL | DataGrid has loading skeleton, empty state message. BUT: empty state doesn't show "clear filters" button or "create new" button. No differentiation between "no records match filter" vs "module has zero records". Loading skeleton doesn't preserve column layout structure. | 🟠 | Add contextual empty states per spec (filter vs total-zero). |
| **R10: Pagination Controls** | ⚠️ PARTIAL | Leads has pagination (page state, page size from useTablePreferences). PaginationControls component exists. BUT: DataGrid has no built-in pagination footer. PAGE_SIZE_OPTIONS missing 25. Contacts/Accounts pages have no pagination at all (render full filtered list). | 🟠 | Add pagination to Contacts/Accounts. Integrate PaginationControls into DataGrid or render below it. |
| **R11: Extensibility** | ✅ PASS | VIEW_OPTIONS registry pattern works. No module-specific conditionals in ModuleWorkspace/ManageColumnsDrawer/useColumnPreferences/useTablePreferences. Adding module requires only registry entry + Module_Config. isValidModule/getSystemDefault/getRequiredColumnIds all auto-work for new modules. | — | Architecture is clean. |
| **R12: Tenant Isolation & Security** | ⚠️ PARTIAL | Backend: tenantId from JWT ✅, userId from JWT ✅, isValidModule check ✅, 404 for unknown module ✅, validateAgainstRegistry rejects invalid IDs ✅, audit log on tenant default changes ✅. BUT: preference routes lack `authorize()` middleware for module view permission (routes only use auth + tenant). | 🟠 | Consider adding module-level view permission check per R12 AC2. |
| **R13: View Mode (Wrap/Clip)** | ❌ FAIL | useTablePreferences exposes viewMode/displayMode. ModuleWorkspace passes it to settings menu. BUT: DataGrid component does NOT consume a viewMode prop. Cells always truncate. No wrap behavior with 52px min / 156px max implemented. | 🟠 | Add viewMode prop to DataGrid and apply clip/wrap styles to cells. |
| **R14: Bulk Selection and Actions** | ⚠️ PARTIAL | useBulkSelection hook exists with select-all, toggle, clear. Leads shows bulk selection bar. BUT: No 100-record cap. Selection doesn't persist across pages. No destructive action confirmation dialog. No partial-failure handling. BulkSelectionBar component exists but not wired to Module_Config bulkActions. | 🔴 | Implement 100-cap in useBulkSelection. Add cross-page selection. Wire to Module_Config. |
| **R15: Sort Persistence** | ⚠️ PARTIAL | useTablePreferences persists sort (fire-and-forget). Sort button label shows field + direction. BUT: clearing sort doesn't persist null (setSort only persists when newSort is truthy). Stale sort field validation missing. Sort button doesn't show "Sort · FieldLabel ↑" exactly (shows "· label ↑/↓" which is close). | 🟠 | Fix null persistence. Add stale sort field handling. |
| **R16: Preference Serialization Round-Trip** | 🔍 NEEDS VERIFICATION | Backend uses Zod schema validation (SaveColumnsBodySchema), parseStoredValue skips corrupted layers, reconcileWithRegistry handles stale columns, max 100 items enforced in schema. No tests found to verify round-trip property. | — | Add property-based tests per design.md testing strategy. |

---

## 3. Module Comparison

| Feature | Leads | Contacts | Accounts | Deals |
|---------|-------|----------|----------|-------|
| Shared DataGrid | ✅ | ✅ | ✅ | ❌ Legacy table |
| Column Preferences | ✅ | ✅ | ✅ | ✅ (loaded, not used) |
| ManageColumnsDrawer | ✅ | ✅ | ✅ | ❌ |
| Column Resize | ✅ | ✅ | ✅ | ❌ |
| Sort | ✅ | ✅ | ✅ | ❌ (hardcoded columns) |
| Filter Rail | ✅ | ✅ | ✅ | ✅ (DealFilters custom) |
| Search | ✅ | ✅ | ✅ | ❌ |
| Pagination | ✅ | ❌ | ❌ | ✅ (usePagination) |
| Selection (Bulk) | ✅ | ✅ | ✅ | ❌ |
| Row Actions | ✅ | ✅ | ✅ | ❌ |
| Table View | ✅ | ✅ | ✅ | ✅ (legacy) |
| List View | ✅ | ✅ (shares table) | ✅ (shares table) | ❌ |
| Grid View | ✅ | ✅ | ✅ | ❌ |
| Tile View | ✅ | ✅ | ✅ | ❌ |
| Kanban View | ✅ | ❌ | ❌ | ❌ |
| Loading State | ✅ | ✅ (via DataGrid) | ✅ (via DataGrid) | ❌ |
| Empty State | ✅ | ✅ | ✅ | ✅ (custom) |
| RBAC Guards | ✅ | ✅ | ✅ | ✅ |
| Responsive | ⚠️ (no priority hiding) | ⚠️ | ⚠️ | ⚠️ |
| View Mode (wrap/clip) | ❌ | ❌ | ❌ | ❌ |

---

## 4. Critical Findings

### [R01] — Selection Cap at 100 Not Enforced

**Severity:** 🔴 HIGH

**Problem:** `useBulkSelection` hook has no maximum selection limit. Users can select unlimited records. The spec (Requirement 14 AC2, Property 12) mandates a hard cap at 100 records with an informational toast when the limit is reached.

**Evidence:** `frontend/src/shared/components/data-grid/use-bulk-selection.ts` — `toggleRow` and `toggleAll` callbacks add to the set without checking size.

**Impact:** Potential performance issues with large selections; bulk actions may timeout or fail if thousands of records are selected. Contradicts documented behavior.

**Required Fix:** Add a cap check in `toggleRow` and `toggleAll`:
```typescript
if (next.size > 100) {
  toast.info('Selection limited to 100 records', { duration: 3000 });
  return; // don't add more
}
```

**Do NOT:** Create a separate selection management system. Extend the existing `useBulkSelection` hook.

---

### [R02] — Client-Side Sort/Filter Instead of Server-Side

**Severity:** 🔴 HIGH

**Problem:** The design.md explicitly states "All data fetching is server-driven. The frontend NEVER sorts or filters locally on paginated results." However, all module pages (Leads, Contacts, Accounts) perform sorting and filtering in `useMemo` on client-side data from DataContext.

**Evidence:**
- `leads-page.tsx` lines ~130-170: `filteredLeads` and `sortedLeads` computed via `useMemo`
- `contacts-page.tsx` lines ~80-130: `filteredContacts` computed via `useMemo`
- `accounts-page.tsx` lines ~100-140: `filteredAccounts` computed via `useMemo`

**Impact:** With DataContext holding all records in memory, this works for small datasets. But it violates the spec's server-side pagination architecture and will not scale. The `ModuleDataFetchParams` interface and `PaginatedResponse` shape defined in the spec are not used.

**Required Fix:** This is a phased migration. Current implementation works with DataContext's client-side data. When `USE_MOCK_DATA=false` and real API is active, module pages should call the backend with `page`, `pageSize`, `sort`, and `filter` parameters. The existing `useTablePreferences` hook already provides the values needed as query params.

**Do NOT:** Immediately break the working client-side implementation. Flag as known technical debt with a migration path when modules move to dedicated data hooks.

---

### [R03] — Deals Module Not Using Shared DataGrid

**Severity:** 🔴 HIGH

**Problem:** The Deals module uses a legacy `DealsTable` component with hardcoded columns, no column preference integration, no column resizing, no bulk selection, no row actions menu, and no column header menus.

**Evidence:** `frontend/src/features/tenant/crm/deals/ui/deals-table.tsx` — custom `<table>` with hardcoded 7 columns. `deals-page.tsx` does not use `useDataGridColumns` or pass effectiveColumns to the table.

**Impact:** Module inconsistency. Deals users cannot customize columns, resize, or reorder. The existing `useColumnPreferences('deals')` call in deals-page.tsx loads preferences but never passes them to the table.

**Required Fix:** Create `deals-data-grid.tsx` following the pattern of `leads-data-grid.tsx`. Wire it into deals-page.tsx replacing the legacy table.

**Do NOT:** Modify the shared DataGrid component to accommodate deal-specific logic. Keep module logic in the feature directory.

---

### [R04] — Responsive Column Strategy Not Implemented

**Severity:** 🔴 HIGH

**Problem:** The `computeVisibleColumns` function specified in design.md does not exist in the codebase. No responsive column hiding based on priority occurs. All visible columns render regardless of viewport width — horizontal scroll is the only fallback.

**Evidence:** No file `use-responsive-columns.ts` exists. `grep_search` for "computeVisibleColumns" and "PRIORITY_ORDER" returns no results in the frontend source.

**Impact:** On narrow viewports, tables show all columns with horizontal scroll, which is adequate but doesn't provide the progressive-disclosure UX specified. Required columns are never hidden (because ALL columns are shown), so no security issue — just a UX gap.

**Required Fix:** Implement `use-responsive-columns.ts` per design.md. Integrate with `useDataGridColumns` or the DataGrid component via a ResizeObserver on the container.

**Do NOT:** Change the column priority values in the registries. They're already correctly assigned.

---

### [R08] — Column Validation Regex Rejects Valid Column IDs

**Severity:** 🔴 HIGH

**Problem:** The Zod `ColumnItemSchema` in `shared/src/validation/preferences.validation.ts` uses regex `^[a-zA-Z0-9]+$` which REJECTS column IDs containing underscores or hyphens. However, several column IDs in the registry use camelCase (which passes) but the regex description says "only alphanumeric characters."

**Evidence:** `preferences.validation.ts` line: `id: z.string().min(1).max(255).regex(/^[a-zA-Z0-9]+$/)`. Column IDs like `emailAndPhone`, `companyName`, `createdAt` all pass this regex. But IDs like `primaryAddressCityState` also pass. No issue currently, but if any ID ever uses hyphens/underscores (common in CRM systems), it will be rejected.

**Impact:** Currently benign since all existing IDs are camelCase alphanumeric. But the regex is more restrictive than necessary and creates a latent trap for future column additions.

**Required Fix:** Change regex to `^[a-zA-Z][a-zA-Z0-9_-]*$` to align with the module param regex pattern and allow future flexibility.

**Do NOT:** Change existing column IDs. Only relax the regex.

---

## 5. Medium-Risk Findings

### [R09] — Leads Uses Feature-Local ManageColumnsDrawer Import

The leads-page.tsx imports `ManageColumnsDrawer` from `'./manage-columns-drawer'` (a local file) rather than from `'@/shared/components/manage-columns-drawer'`. This means leads might use a different version than contacts/accounts which import from the shared location.

**Fix:** Verify the local file is identical to the shared one, then switch to the shared import.

### [R10] — View Type Preference Not Wired to Module Pages

ModuleWorkspace supports `moduleConfig` prop which activates `useViewTypePreference` internally. But Leads/Contacts/Accounts pages use local `useState` for `activeView` instead of persisted preference. The `useViewTypePreference` hook exists and works but isn't used by module pages directly.

**Fix:** Either pass `moduleConfig` to ModuleWorkspace or use `useViewTypePreference` in module pages.

### [R11] — View Mode (Wrap/Clip) Not Applied to DataGrid

`useTablePreferences` manages `viewMode` state. The settings menu allows toggling. But the DataGrid component has no `viewMode` prop and always renders with `truncate` class on cells. The wrap behavior (min 52px, max 156px, 3 lines) is not implemented.

**Fix:** Add a `viewMode` prop to DataGrid. When "wrap", apply `whitespace-normal` with max-height. When "clip", apply current truncate behavior.

### [R13] — Selection Not Preserved Across Pages

Per Requirement 14 AC4, selection should persist across page navigation. Currently, Leads uses a local `selectedIds` array that only tracks the current page's selections. When the user navigates pages, previous selections are lost.

**Fix:** Track selected IDs across all pages in a parent-level Set, not per-page.

### [R19] — PAGE_SIZE_OPTIONS Missing 25

The `PAGE_SIZE_OPTIONS` constant in `module-workspace.tsx` is `[10, 20, 30, 40, 50]`. Per Requirement 10 AC3, supported sizes are `[10, 20, 25, 30, 40, 50]` with default 25.

**Fix:** Add 25 to the array.

### [R22] — No Filter Persistence

Requirement 6 AC5 specifies filter selections should persist to UserPreference. Currently, filters are URL-synced only (via `useFilterUrlSync`). No server persistence occurs.

**Fix:** Add filter persistence via `tablePreferencesApi.saveFilters()` (the API method exists but isn't called).

---

## 6. Low-Risk Findings

- **R23**: Leads page at 946 lines exceeds 400-line component limit. Extract sub-views (Tile, Grid, Kanban, Drawer content) into separate files.
- **R24**: ModuleWorkspace at 1057 lines exceeds limit. Extract SortDropdownInline and TableSettingsMenuInline to separate files.
- **R25**: `organizations: any[]` in LeadDrawerOverview — use proper `Organization` type.
- **R26**: Leads page has both `selectedIds: string[]` and passes `new Set(selectedIds)` to DataGrid — simplify to a single Set.
- **R28**: Grid/Tile/Kanban views in Leads render `filteredLeads` (unpaginated) while Table/List render `paginatedLeads`.
- **R29**: ModuleWorkspace default `pageSize` prop is 10, but `useTablePreferences` defaults to 25. The prop should default to 25.
- **R30**: `ColumnConfigItem` includes optional `width` field, but preference API doesn't persist it. Low priority.
- **R31**: Validation regex is slightly restrictive but all current IDs pass.

---

## 7. Table / Column Alignment Audit

### Header/Body Alignment
✅ **PASS** — DataGrid uses `<table>` with `<colgroup>` defining widths per column. Header `<th>` and body `<td>` share the same width via `colgroup`, ensuring alignment.

### Column Width Consistency
✅ **PASS** — `getColumnWidth()` returns the same value for header and body cells. Pinned columns use `style={{ left: offset }}` calculated from the same width source.

### Resize Behavior
✅ **PASS** — `useColumnResize` updates width state on pointermove. Both header and body re-render with new width from `columnWidths[col.id]`. Min 80px / max 800px enforced.

### Overflow
✅ **PASS** — Cells use `truncate` class (text-overflow: ellipsis). Container has `overflow-auto` for two-axis scroll.

### Sticky Header Behavior
✅ **PASS** — `<thead className="sticky top-0 z-20">`. Pinned columns use `sticky` with explicit z-index. Shadow separators on pinned boundaries.

### Column Visibility
⚠️ **PARTIAL** — `useDataGridColumns` filters to visible columns only. ManageColumnsDrawer toggles visibility. BUT: hiding via column header menu (`onHideColumn`) directly calls `saveColumns` with the updated array — this bypasses the ManageColumnsDrawer's local state, which is correct behavior (immediate hide from header = auto-save, not manual-save).

### Column Ordering
✅ **PASS** — Columns sorted by `order` field before rendering. ManageColumnsDrawer reassigns sequential 0-based orders after each DnD operation. Table renders in order.

### Priority Behavior
❌ **NOT IMPLEMENTED** — No responsive column hiding by priority. See R04.

### ManageColumns Synchronization
✅ **PASS** — Drawer reads from `effectiveColumns` prop (server-backed). After save, the hook updates state from server response. The table re-renders with the new config.

---

## 8. Security & Tenant Isolation Audit

| Check | Status | Evidence |
|-------|--------|----------|
| Authentication on preference routes | ✅ | `router.use(authMiddleware)` in preferences.routes.ts |
| Tenant middleware | ✅ | `router.use(tenantMiddleware)` extracts tenantId from JWT |
| TenantId from JWT only | ✅ | Controller uses `req.user!.tenantId` — never from body/params |
| UserId from JWT only | ✅ | Controller uses `req.user!.userId` |
| Module validated against registry | ✅ | `isValidModule(module)` check returns 404 for unknown modules |
| Invalid column IDs rejected | ✅ | `validateAgainstRegistry` checks all IDs against registry |
| Required columns cannot be hidden | ✅ | Validation rejects `visible: false` on required columns |
| Cross-tenant access returns 404 | ✅ | Repository queries include `tenantId` in WHERE clause |
| User preference isolation | ✅ | Unique constraint on `[tenantId, userId, module, key]` |
| Tenant admin permission for defaults | ✅ | `authorize('settings.edit')` on tenant-default routes |
| Audit logging on tenant defaults | ✅ | `writeAuditLog()` fire-and-forget in upsertTenantDefault/deleteTenantDefault |
| Frontend preferences don't grant data access | ✅ | Preferences are presentation-only. Data endpoints have their own auth/rbac chain. |
| Module view permission check (R12 AC2) | ⚠️ | Not implemented — preference routes don't check `module.view` permission |

---

## 9. Validation Audit

| Validation | Frontend | Backend | Status |
|-----------|----------|---------|--------|
| Module ID format | ❌ Not validated | ✅ `isValidModule()` | ⚠️ Partial |
| Column ID in registry | ❌ Not validated client-side | ✅ `validateAgainstRegistry()` | ✅ Backend authoritative |
| Column order non-negative integer | ❌ | ✅ Zod schema | ✅ |
| Column duplicates | ❌ | ✅ Zod refine | ✅ |
| Max 100 columns | ❌ | ✅ `.max(100)` in schema | ✅ |
| Required columns visible | ❌ | ✅ `validateAgainstRegistry` | ✅ |
| Page size range | ❌ Not validated | ❌ No backend validation | ❌ Missing |
| Sort field valid | ❌ | ❌ No backend validation found | ❌ Missing |
| Sort direction enum | ❌ | ❌ No backend validation found | ❌ Missing |
| View type enum | ❌ | ❌ No backend validation found | ❌ Missing |

**Key Gap:** The `table-preferences.api.ts` endpoints (`/preferences/table/:module/*`) are not visible in `preferences.routes.ts`. These routes may be defined elsewhere or may not exist yet on the backend. This needs verification.

---

## 10. Recommended Fix Order

### PHASE 1 — BLOCKERS / HIGH RISK (Week 1)

1. **[R08]** Fix column ID validation regex (5 min, prevents future breakage)
2. **[R01]** Add 100-record selection cap to `useBulkSelection` (30 min)
3. **[R05]** Make `priority` field required in `ColumnDefinition` type (15 min, all registries already have it)
4. **[R06]** Add pagination + page reset to Contacts and Accounts pages (2 hours)
5. **[R07]** Verify/implement table preferences backend routes (2–4 hours)
6. **[R03]** Create `deals-data-grid.tsx` and migrate Deals module (4–6 hours)
7. **[R04]** Implement responsive column strategy hook (4–6 hours)
8. **[R02]** Document client-side vs server-side data fetching migration plan (1 hour)

### PHASE 2 — MEDIUM RISK (Week 2)

9. **[R19]** Add 25 to PAGE_SIZE_OPTIONS (5 min)
10. **[R11]** Implement wrap/clip view mode in DataGrid (2–3 hours)
11. **[R09]** Fix leads-page ManageColumnsDrawer import to shared (15 min)
12. **[R10]** Wire useViewTypePreference to module pages (1 hour)
13. **[R13]** Implement cross-page selection persistence (2 hours)
14. **[R16]** Add contextual empty states (clear filters button, create button) (2 hours)
15. **[R17/R18]** Fix sort null persistence and stale sort handling (1 hour)
16. **[R22]** Add filter persistence via tablePreferencesApi.saveFilters (2 hours)
17. **[R20]** Pass Module_Config objects to ModuleWorkspace in each module (2 hours)

### PHASE 3 — LOW RISK / POLISH (Week 3)

18. **[R23/R24]** Extract sub-components from oversized files (2 hours)
19. **[R25]** Fix `any` type usage in Leads drawer (15 min)
20. **[R26]** Clean up dual selectedIds in leads-page (15 min)
21. **[R28]** Apply pagination to Grid/Tile/Kanban views (1 hour)
22. **[R29]** Align default pageSize between ModuleWorkspace and useTablePreferences (5 min)
23. Add property-based tests per design.md testing strategy (ongoing)
24. Add accessibility improvements (keyboard nav in DataGrid, screen reader labels)

---

## 11. Final Readiness Assessment

🟠 **NEEDS MAJOR FIXES**

The architecture is sound and well-designed. The shared DataGrid, preference hooks, ManageColumnsDrawer, and VIEW_OPTIONS registry are production-quality components. However:

1. **Module inconsistency** (Deals) breaks the "unified" promise
2. **Responsive column strategy** is specified but unimplemented
3. **Bulk selection cap** is a requirement violation with UX impact
4. **View mode (wrap/clip)** renders in the settings menu but does nothing
5. **Page size options** don't match the spec

Once Phase 1 fixes are completed, the system moves to 🟡 NEEDS MINOR FIXES. After Phase 2, it reaches 🟢 PRODUCTION READY for the core table/column infrastructure.

---

## Top 10 Actions Before Implementation

| Priority | Action | Category | Effort |
|----------|--------|----------|--------|
| 1 | Fix column ID validation regex | Security | 5 min |
| 2 | Add 100-record selection cap | Data integrity | 30 min |
| 3 | Make `priority` required in ColumnDefinition | Type safety | 15 min |
| 4 | Add pagination to Contacts + Accounts | Core functionality | 2 hours |
| 5 | Create deals-data-grid.tsx (Deals migration) | Core functionality | 4–6 hours |
| 6 | Verify/implement table preferences backend routes | Architecture | 2–4 hours |
| 7 | Implement responsive column strategy | UX | 4–6 hours |
| 8 | Implement wrap/clip view mode in DataGrid | UX | 2–3 hours |
| 9 | Add 25 to PAGE_SIZE_OPTIONS | UX | 5 min |
| 10 | Fix sort null persistence | Core functionality | 30 min |
