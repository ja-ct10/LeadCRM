# LeadCRM — Persistent Preferences Rule

## Core Mandate

All persistent user/module UI preferences MUST use LeadCRM's centralized server-backed preference architecture (`UserPreference` / `TenantPreference` models + preferences module API).

## What This Covers

- Column visibility, order, and width
- Saved views and saved filters
- Dashboard widget layouts
- Table sort/page-size defaults
- Sidebar state (collapsed sections, pinned items)
- Module-specific display settings (e.g., pipeline view mode)
- Any user-configurable setting that should survive refresh, logout, or device change

## Rules

1. **Reuse the centralized architecture.** New modules MUST NOT create independent preference tables, localStorage-based persistence, or module-specific preference services when the centralized `UserPreference` / `TenantPreference` infrastructure is applicable.

2. **Tenant + user scoping is mandatory.** Preferences MUST be scoped to the authenticated tenant and user. The preference key structure is: `tenantId + userId + module + key` (user-level) or `tenantId + module + key` (tenant-level default).

3. **Server is the source of truth.** The browser may hold temporary UI state (hover, open/closed panels, drag position), but it MUST NOT be the authoritative source of persistent preferences. The database owns persistent preference data.

4. **Resolution order.** When reading a preference:
   ```
   UserPreference (user + tenant + module + key)
     ↓ fallback
   TenantPreference (tenant + module + key)
     ↓ fallback
   System/Code Default
   ```

5. **Separation of concerns.** User preferences, tenant configuration, system configuration, and business/domain data MUST remain separate concepts. A preference is NOT a business record — do not store leads, deals, workflows, or other domain objects in the preference table.

6. **localStorage is NOT preference persistence.** localStorage is allowed only for genuinely device-local, non-authoritative concerns (theme, accent color, development mock data). It MUST NOT be the source of truth for any preference that should roam across sessions or devices.

7. **Inspect before inventing.** Before introducing a new preference mechanism, inspect the existing preference module (`backend/src/modules/preferences/`) and reuse the established infrastructure (repository, service, controller, API routes, frontend hooks).

8. **Exceptions require justification.** Any architectural exception to this rule MUST be explicitly justified and documented (e.g., in an ADR or inline comment explaining why the centralized architecture is insufficient for the specific case).

## Existing Infrastructure

| Layer | Location |
|---|---|
| Backend module | `backend/src/modules/preferences/` |
| Column registry (backend) | `backend/src/modules/preferences/column-registry.ts` |
| Prisma models | `UserPreference`, `TenantPreference` |
| API routes | `GET/PUT/DELETE /api/v1/preferences/columns/:module` |
| Tenant default routes | `PUT/DELETE /api/v1/preferences/columns/:module/tenant-default` |
| Shared types | `shared/src/types/preferences.ts` |
| Shared contracts | `shared/src/contracts/preferences.contracts.ts` |
| Shared validation | `shared/src/validation/preferences.validation.ts` |
| Frontend API client | `frontend/src/shared/services/preferences.api.ts` |
| Frontend hook (shared) | `frontend/src/shared/hooks/use-column-preferences.ts` |
| Frontend column registries | `frontend/src/shared/constants/column-registries.ts` |
| ManageColumnsDrawer (shared) | `frontend/src/shared/components/manage-columns-drawer.tsx` |
| Column table helpers | `frontend/src/shared/components/column-table-helpers.ts` |

## Registered Modules

| Module ID | Backend Registry | Frontend Registry |
|---|---|---|
| `leads` | ✅ | ✅ |
| `accounts` | ✅ | ✅ |
| `contacts` | ✅ | ✅ |
| `deals` | ✅ | ✅ |

## Adding a New Module

1. Add a `ModuleRegistry` entry to `backend/src/modules/preferences/column-registry.ts`
2. Add a matching `ColumnDefinition[]` to `frontend/src/shared/constants/column-registries.ts`
3. Use `useColumnPreferences('module-name')` in the module's page
4. Render `<ManageColumnsDrawer module="module-name" registry={...} ... />`
5. No new backend routes, services, or API endpoints needed — it all works via the module param

## Anti-Patterns (NEVER)

- Creating a new `ModulePreference` table for a single module
- Persisting column configs or view settings to localStorage as the source of truth
- Building a parallel preference service that duplicates the centralized one
- Storing preferences without tenant scoping
- Treating preferences as business data (or vice versa)
