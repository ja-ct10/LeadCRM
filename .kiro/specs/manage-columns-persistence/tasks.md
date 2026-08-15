# Implementation Plan: Manage Columns Persistence

## Overview

Implements a server-persisted column configuration system for the LeadCRM Leads table following the Layered Service architecture (Route → Controller → Service → Repository + Column Registry). The system resolves effective columns via a hierarchy: System Default → Tenant Default → User Override. Frontend uses DataContext + useColumnPreferences hook + Manage Columns Drawer with optimistic updates and rollback. All code is TypeScript across the monorepo.

## Tasks

- [ ] 1. Shared types and contracts
  - [ ] 1.1 Create shared preference types and contracts
    - Create `shared/src/types/preferences.ts` with `ColumnConfigItem`, `ColumnConfig`, `ColumnDefinition` interfaces
    - Create `shared/src/contracts/preferences.contracts.ts` with API request/response contracts (success envelope, error shape)
    - Create `shared/src/validation/preferences.validation.ts` with shared Zod schemas (`ColumnModuleParamsSchema`, `ColumnItemSchema`, `SaveColumnsBodySchema`)
    - Export all from shared package index
    - _Requirements: 6.1, 14.1, 14.2, 15.1, 15.2, 15.6_

- [ ] 2. Database schema and migration
  - [ ] 2.1 Add UserPreference and TenantPreference models to Prisma schema
    - Add `UserPreference` model with id (UUID), tenantId, userId, module (VarChar 64), key (VarChar 128), value (Json), createdAt, updatedAt
    - Add `TenantPreference` model with id (UUID), tenantId, module (VarChar 64), key (VarChar 128), value (Json), createdAt, updatedAt
    - Add unique constraint `[tenantId, userId, module, key]` on UserPreference
    - Add unique constraint `[tenantId, module, key]` on TenantPreference
    - Add index `[tenantId, module]` on both tables
    - Add foreign key relations: UserPreference → Tenant (onDelete: Cascade), UserPreference → User (onDelete: Cascade), TenantPreference → Tenant (onDelete: Cascade)
    - Add relation fields on Tenant and User models
    - Run `prisma migrate dev` to create additive-only migration
    - Run `prisma generate` to update client
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 7.4_

- [ ] 3. Backend column registry and repository
  - [ ] 3.1 Create the Column Registry module
    - Create `backend/src/modules/preferences/column-registry.ts`
    - Define `ColumnDefinition` and `ModuleRegistry` interfaces
    - Implement `LEADS_COLUMN_REGISTRY` with all 12 Leads columns (firstName, lastName, email, phone, companyName, status, source, assignedUserId, productInterest, address, createdAt, accountId)
    - Implement `COLUMN_REGISTRIES` record keyed by module name
    - Implement helper functions: `getRegistryForModule()`, `getSystemDefault()`, `getRequiredColumnIds()`, `isValidModule()`
    - _Requirements: 6.1, 6.3, 6.4, 14.4_

  - [ ] 3.2 Create the Preferences Repository
    - Create `backend/src/modules/preferences/preferences.repository.ts`
    - Implement `findUserPreference(tenantId, userId, module, key)` with mandatory tenantId + userId filter
    - Implement `upsertUserPreference(tenantId, userId, module, key, value)` using INSERT ... ON CONFLICT UPDATE
    - Implement `deleteUserPreference(tenantId, userId, module, key)`
    - Implement `findTenantPreference(tenantId, module, key)` with mandatory tenantId filter
    - Implement `upsertTenantPreference(tenantId, module, key, value)`
    - Implement `deleteTenantPreference(tenantId, module, key)`
    - All queries scoped by tenantId — no cross-tenant access
    - _Requirements: 2.1, 2.2, 2.6, 7.2, 7.4, 18.1, 18.2_

  - [ ]* 3.3 Write property tests for Column Registry
    - **Property 5: Unknown Column Rejection** — generate configs with invalid column ids, verify registry rejects them
    - **Property 7: Column ID Format Validation** — generate strings with special characters and excessive lengths, verify registry validation rejects them
    - **Validates: Requirements 6.2, 6.6, 15.3, 15.6**

- [ ] 4. Backend service layer
  - [ ] 4.1 Implement Preferences Service — resolution and reconciliation
    - Create `backend/src/modules/preferences/preferences.service.ts`
    - Implement `resolveEffectiveColumns(tenantId, userId, module)`: User > Tenant > System hierarchy with full replacement semantics
    - Implement `reconcileWithRegistry(config, module)`: strip stale columns, insert new registry columns at default positions
    - Implement `validateAgainstRegistry(config, module)`: reject unknown columns, enforce required column visibility, validate order bounds, check duplicates
    - Handle corrupted stored preferences: skip layer, resolve from next layer
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.3, 6.5_

  - [ ] 4.2 Implement Preferences Service — CRUD operations and audit
    - Implement `upsertUserPreference(tenantId, userId, module, config)`: validate → reconcile → persist → return effective columns
    - Implement `deleteUserPreference(tenantId, userId, module)`: delete record → return fallback effective columns
    - Implement `upsertTenantDefault(tenantId, userId, module, config, ipAddress?)`: validate → persist → audit log → return config
    - Implement `deleteTenantDefault(tenantId, userId, module, ipAddress?)`: delete record → audit log → return fallback
    - Audit log integration: create AuditLog entries for tenant-default create/update/delete operations
    - Fire-and-forget audit: if audit write fails, log warning but complete preference mutation
    - _Requirements: 3.2, 3.3, 4.1, 4.2, 4.5, 5.2, 5.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 4.3 Write property tests for resolution hierarchy and reconciliation
    - **Property 1: Resolution Hierarchy** — generate random layer combinations (user/tenant/system present/absent), verify highest available returned as full replacement
    - **Property 2: Registry Reconciliation** — generate configs missing columns, verify new columns inserted at registry-defined defaults
    - **Property 4: Required Column Auto-Inclusion** — generate configs omitting required columns, verify they are auto-included with visible:true
    - **Property 6: Stale Column Stripping** — generate configs with stale column ids, verify they are stripped from result
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 5.3, 6.5, 16.1**

  - [ ]* 4.4 Write property tests for validation logic
    - **Property 3: Required Column Visibility Enforcement** — generate configs hiding required columns, verify rejection
    - **Property 12: Duplicate Column Rejection** — generate configs with duplicate ids, verify rejection
    - **Property 13: Payload Constraint Validation** — generate oversized payloads, invalid order values, excess column counts, verify rejection
    - **Validates: Requirements 5.2, 5.5, 15.1, 15.2, 15.4, 15.5**

- [ ] 5. Backend controller and routes
  - [ ] 5.1 Create Preferences Controller
    - Create `backend/src/modules/preferences/preferences.controller.ts`
    - Implement `getEffectiveColumns(req, res)`: extract tenantId/userId from JWT, call service.resolveEffectiveColumns, return 200 with data envelope
    - Implement `saveUserPreference(req, res)`: parse body, call service.upsertUserPreference, return 200
    - Implement `deleteUserPreference(req, res)`: call service.deleteUserPreference, return 200 with fallback columns
    - Implement `saveTenantDefault(req, res)`: parse body, extract ipAddress, call service.upsertTenantDefault, return 200
    - Implement `deleteTenantDefault(req, res)`: call service.deleteTenantDefault, return 200 with fallback
    - Handle errors: 400 validation, 401 auth, 404 not-found (opaque), 500 internal
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ] 5.2 Create Preferences DTO (Zod validation schemas)
    - Create `backend/src/modules/preferences/preferences.dto.ts`
    - Define `GetColumnsParamsSchema` (module path param validation)
    - Define `SaveColumnsBodySchema` (columns array with id, visible, order, duplicate check, max 64KB)
    - Define `ColumnItemSchema` (individual column validation: id regex, boolean visible, non-negative int order)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ] 5.3 Create Preferences Routes and wire middleware
    - Create `backend/src/modules/preferences/preferences.routes.ts`
    - `GET /:module` — authenticate → validate(params) → getEffectiveColumns
    - `PUT /:module` — authenticate → validate(params+body) → saveUserPreference
    - `DELETE /:module` — authenticate → validate(params) → deleteUserPreference
    - `PUT /:module/tenant-default` — authenticate → rbac('settings', 'canEdit') → validate(params+body) → saveTenantDefault
    - `DELETE /:module/tenant-default` — authenticate → rbac('settings', 'canEdit') → validate(params) → deleteTenantDefault
    - Register routes under `/api/v1/preferences/columns` in main route file
    - _Requirements: 3.1, 4.3, 7.1, 7.5, 7.6, 14.3_

- [ ] 6. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend API service and hook
  - [ ] 7.1 Create Preferences API service
    - Create `frontend/src/shared/services/preferences.api.ts`
    - Implement `getEffectiveColumns(module)` → GET `/api/v1/preferences/columns/:module`
    - Implement `saveUserPreference(module, config)` → PUT `/api/v1/preferences/columns/:module`
    - Implement `deleteUserPreference(module)` → DELETE `/api/v1/preferences/columns/:module`
    - Implement `saveTenantDefault(module, config)` → PUT `/api/v1/preferences/columns/:module/tenant-default`
    - Implement `deleteTenantDefault(module)` → DELETE `/api/v1/preferences/columns/:module/tenant-default`
    - Use apiClient with `credentials: 'include'`, 10s AbortController timeout
    - _Requirements: 2.4, 9.6, 13.7_

  - [ ] 7.2 Create useColumnPreferences hook
    - Create `frontend/src/features/tenant/crm/leads/hooks/use-column-preferences.ts`
    - Implement `useColumnPreferences(module)` returning: effectiveColumns, isLoading, isSaving, saveError, saveColumns, resetColumns, retryCount
    - `saveColumns`: optimistic update → API call → confirm or rollback
    - `resetColumns`: confirmation → DELETE → update state with fallback
    - Retry logic: up to 3 attempts on failure
    - Connect to DataContext for state management
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 10.2, 10.4_

- [ ] 8. Frontend DataContext integration
  - [ ] 8.1 Extend DataContext with column preferences state
    - Add `effectiveColumns` state (per-module map) to DataContext
    - Add `columnPreferencesLoading` boolean
    - Fetch effective columns on auth (Batch 1) and cache result
    - Implement `saveColumnPreference(module, config)`: optimistic update → API → confirm/rollback
    - Implement `resetColumnPreference(module)`: DELETE → update with fallback
    - Server response always overwrites cache (cache subordination)
    - Serve System_Default if fetch fails on initial load
    - _Requirements: 2.5, 9.1, 9.4, 9.7, 10.2, 10.4, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 8.2 Write property tests for optimistic update and rollback
    - **Property 9: Optimistic Update Immediacy** — verify DataContext updates state synchronously before API response
    - **Property 10: Failure Rollback Integrity** — generate pre-save states, simulate API failures, verify state reverts exactly
    - **Property 15: Cache Authority** — verify server response overwrites cached state regardless of prior cached state
    - **Validates: Requirements 9.1, 9.4, 10.4, 2.5, 13.2, 13.4**

- [ ] 9. Manage Columns Drawer UI
  - [ ] 9.1 Create Manage Columns Drawer component
    - Create `frontend/src/features/tenant/crm/leads/ui/manage-columns-drawer.tsx`
    - Implement slide-in panel from right with semi-transparent backdrop
    - Display all columns from registry as vertical list with: drag handle, column label, visibility toggle
    - Required columns: show locked indicator, disable visibility toggle, allow reorder
    - Non-required columns: show toggle switch for visibility
    - Search input with case-insensitive substring filtering on column labels (no min chars)
    - Save button (disabled when no changes) and Reset to Default button
    - Saving state indicator ("Saving..." → "Saved" for 2s)
    - Error state with Retry button (up to 3 retries)
    - Confirmation dialog on Reset to Default
    - Confirmation prompt when closing with unsaved changes
    - Dark mode classes on every element
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.8, 8.10, 8.11, 9.2, 9.3, 9.5, 10.1_

  - [ ] 9.2 Add drag-and-drop reordering with @dnd-kit
    - Integrate @dnd-kit/core and @dnd-kit/sortable for column reordering
    - All columns (including required) are draggable
    - Update order values on drop
    - Respect search filter: hide non-matching items but preserve their order
    - _Requirements: 8.4_

  - [ ] 9.3 Add keyboard accessibility and focus management
    - Implement focus trap inside open drawer (tab cycles within drawer)
    - Tab navigation through all interactive elements
    - Enter/space to activate toggles
    - Escape to close (without saving)
    - Return focus to "Manage Columns" button on close
    - _Requirements: 8.9_

  - [ ]* 9.4 Write property test for search filtering
    - **Property 8: Search Filtering Correctness** — generate column lists and search strings, verify filtered result contains exactly columns whose label includes the search as case-insensitive substring, preserving relative order
    - **Validates: Requirements 8.3**

- [ ] 10. Leads table integration
  - [ ] 10.1 Integrate effective columns into Leads table
    - Modify `frontend/src/features/tenant/crm/leads/ui/leads-page.tsx` (or leads table component)
    - Render only visible columns from effectiveColumns, in ascending order of `order` field
    - Add "Manage Columns" button to table toolbar
    - Wire button to open Manage Columns Drawer
    - Pass registry data and module identifier via props to drawer
    - _Requirements: 17.1, 8.1, 14.5_

  - [ ] 10.2 Add responsive column behavior
    - Below 768px (md): show only required columns + first 2 non-required visible columns
    - 768px–1024px (md to lg): show required columns + up to 4 non-required visible columns
    - Above 1024px (lg+): show all visible columns
    - Use Tailwind responsive utility classes (hidden, md:table-cell, lg:table-cell)
    - Drawer: full-screen panel below 640px, side drawer above 640px
    - _Requirements: 17.2, 17.3, 17.4, 17.5_

  - [ ]* 10.3 Write property test for visible column rendering
    - **Property 14: Visible Column Rendering** — generate effectiveColumns configs, verify table renders exactly visible:true columns in ascending order of order field
    - **Validates: Requirements 17.1**

- [ ] 11. Checkpoint — Frontend integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. localStorage migration and backward compatibility
  - [ ] 12.1 Implement localStorage migration logic
    - Create migration utility in `frontend/src/features/tenant/crm/leads/services/local-storage-migration.ts`
    - Execute before first Leads table render (one-time)
    - Read existing localStorage column configuration if present
    - Validate against Column Registry: discard invalid JSON or unknown column ids
    - If valid: save as User_Preference via PUT API, then clear localStorage entry
    - If invalid or empty: clear localStorage entry, proceed with normal resolution
    - Do not block page load or show errors on migration failure
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ]* 12.2 Write unit tests for localStorage migration
    - Test valid localStorage data migration
    - Test invalid JSON handling
    - Test unknown column ids handling
    - Test empty localStorage handling
    - Test migration does not block page load on failure
    - _Requirements: 16.3, 16.4, 16.5_

- [ ] 13. User preference independence validation
  - [ ]* 13.1 Write property test for user preference independence
    - **Property 11: User Preference Independence** — generate user preferences, mutate tenant preference, verify all user preference records remain unchanged
    - **Validates: Requirements 4.5**

- [ ] 14. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after backend and frontend phases
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all code in TypeScript
- Backend follows existing LeadCRM patterns: Route → Controller → Service → Repository
- Frontend follows DataContext pattern with optimistic updates
- All queries must filter by tenantId (repository layer enforcement)
- Audit logging is fire-and-forget — failure does not block preference mutations
- The Column Registry is the single source of truth for available columns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "8.1"] },
    { "id": 9, "tasks": ["8.2", "9.1"] },
    { "id": 10, "tasks": ["9.2", "9.3"] },
    { "id": 11, "tasks": ["9.4", "10.1"] },
    { "id": 12, "tasks": ["10.2", "10.3"] },
    { "id": 13, "tasks": ["12.1"] },
    { "id": 14, "tasks": ["12.2", "13.1"] }
  ]
}
```
