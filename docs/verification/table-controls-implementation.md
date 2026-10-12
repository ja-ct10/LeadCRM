# Table controls implementation and verification

Current sorting update: the [column-specific sorting report](column-specific-sorting.md) supersedes this report's all-fields column menu. Column hamburgers now affect their own field; the complete picker lives under Sort Table in settings. The verification below records the earlier table-controls work and settings-menu placement.

Date: 12 October 2026, Asia/Manila. Base: `90d74df7b164afd332454c954614825183690269` on `main`. This report supersedes the earlier requirement that the combined Lead Name must remain visible. The screenshots are visual references; the user's explicit requirements define the behavior.

Follow-up to `9d5d0a3b`: the latest requested placement puts Manage Columns inside the existing table settings icon menu and removes its separate toolbar button. This replaces the earlier direct-button placement. The follow-up was checked with a frontend production build, 31 existing menu/drawer tests, and the 18 real API/SQL browser acceptance groups below.

## Delivered behavior

The seven active configurable tables now use one table settings icon after Refresh. **Manage Columns** is its first menu item and opens the existing drawer; **Reset Column Size** remains in that menu. There is no separate Manage Columns toolbar button or duplicate drawer button in the table header. Closing the drawer restores focus to the table settings icon.

The hamburger in each data-column header opens the shared accessible menu. It lists the module's supported sort fields, including hidden fields, ascending/descending actions, and **Restore default sorting**. The current sort and selected direction are indicated. Pinned headers use the same menu. Header clicks and the redundant standalone sort controls no longer compete with it. Sorting is persisted through the existing table preference API. API lists order matching records before pagination; Users retains its existing complete-directory loading pattern and applies backend ordering to each fetched page before local filtering/pagination.

Lead **Name** is hideable, fixed first among data columns whenever enabled, and pinned left. Fresh defaults enable Name and hide First Name/Last Name. Enabling either separate column while Name is visible presents the exact requested confirmation; confirming changes only the drawer draft. Enabling Name while either separate column is visible presents the reverse confirmation and hides both separate columns after confirmation. Cancel leaves the draft unchanged. The existing Save flow persists the confirmed layout. Form validation and stored person fields are unchanged.

Legacy preferences are reconciled deterministically: an explicitly enabled combined Name wins over conflicting separate columns; an explicitly hidden Name retains separate-column choices. A customized pre-combined layout retains its separate-column choices with Name hidden. Historical untouched default layouts upgrade to the combined defaults. Supported unrelated visibility, relative order and widths are preserved. Users' combined User column is also hideable and fixed first; it has no separate-name table choices. Contacts currently offers separate name columns only, so no new combined projection or switching rule was introduced there.

**Reset Column Size** removes only width properties from the current normalized column layout through the existing serialized preference write queue. It preserves visibility, order, sorting, filters and pagination, and survives reload. Failed writes restore the visible baseline and offer clear retry feedback. The drawer's separate full-layout reset retains its existing behavior.

Refresh invokes the existing data hook/cache refresh operation, displays a spinner, and blocks repeated clicks while loading. Successful refreshes display current API rows and totals while preserving search, filters, sorting, page size and a valid current page. Invalid pages recover to the remaining page. Failure keeps the current rows and presents an error; retry uses the same refresh operation. There is no additional fetching mechanism.

## Scope and inspection findings

| Table | Supported sort fields | Default sort | Existing data/preference handling reused |
| --- | --- | --- | --- |
| Leads | Name, First Name, Last Name, Email, Phone, Company Name, Status, Lead Source, Created, Updated | Created descending | Lead data hook, shared column and table preference hooks |
| Contacts | First Name, Last Name, Email, Phone, Company, Status, Source, Created | Created descending | Existing fresh-refetch pattern and busy lock, shared preference hooks |
| Accounts | Account Name, Industry, Company Size, City, Country, Created | Created descending | Account data hook and shared preference hooks |
| Tasks | Task title, Due Date, Created, Updated | Created descending | Existing Task query/cache and identity-aware column preference queue |
| Campaigns | Campaign, Created | Created descending | Existing cached campaign list, templates/metrics refresh and shared preference hooks |
| Workflows | Name, Status, Created | Created descending | Existing cached workflow list and shared preference hooks |
| Users | User name, Role, Contact email, Status, Groups, Created | Created descending | Existing directory loader, shared page cache and preference hooks |

Inspection found that Leads' toolbar reset deleted the complete column override, several grids retained duplicate settings buttons, pinned headers bypassed the working hamburger menu, and Users' frontend sort choices differed from the backend/preference allowlists. Those discrepancies are corrected. Contacts' actual refetch and request lock supplied the refresh behavior reference; shared components now expose consistent feedback without changing the underlying cache ownership.

The active Deals route is the Pipeline board, as documented in the [module audit](module-table-audit.md#consumer-and-data-map). Its compatibility DataGrid has no active route consumer; its shared menu contract was updated, but a new Deals table was not added. Small member/report grids without a column preference contract do not gain an invented preference endpoint.

The exact requested skill names were not present in the installed catalog. The installed equivalents used were `ui-styling`, `engineering:debug`, `design:accessibility-review`, and `engineering:testing-strategy`. The existing route, state, API, preference and accessibility patterns were inspected before reuse. See the existing [architecture](../ARCHITECTURE.md), [structure](../STRUCTURE.md) and [API](../API.md) documentation for the unchanged boundaries and permission model.

## Verification

Verification used the compiled production frontend, the real Express routes and auth/session middleware, Prisma, and disposable PGlite SQL populated through the repository migrations. It used seeded local records rather than mock API rows. Requests from the browser were forwarded to the real local API. Selected failures were deliberately injected to check recovery.

| Check | Result / evidence |
| --- | --- |
| Workspace builds | Shared, backend and frontend production builds passed; the follow-up frontend build includes Manage Columns inside the settings menu |
| Workspace lint | `npm run lint` passed across all workspaces |
| Frontend regression tests | 210 passed across 20 affected test files; final JSON reported zero failures |
| Backend regression tests | 33 passed across four files covering name preferences, preference invariants, Users search and Lead list sorting |
| Authenticated SQL integration | 12 passed for Lead create/update/validation, restrictions, tenant isolation and existing form contracts |
| Browser/API acceptance | 18 acceptance groups; no browser page errors; result recorded in [browser results](table-controls-browser-results.json) |
| Server pagination | 39 supported sort fields in both directions: 78 cases comparing complete ordered results with page 2 at limit 1, using independent allowlists |
| Toolbar and menu | All seven tables have one settings icon after Refresh with a single Manage Columns menu item, keyboard drawer entry and focus restoration, no separate/embedded duplicate, hidden-field sorting, saved selection and default restoration |
| Name switching | Confirmation and cancellation in both directions, keyboard confirmation/Escape, no persistence before Save, failed Save retry, reload, legacy reconciliation |
| Column sizes | Real pointer resize, saved widths/reload, width-only reset, unchanged layout/table preferences, reset failure rollback and retry |
| Refresh | Direct SQL record updates/inserts become visible with new totals; search, sort, size and page 2 survive; disabled/spinning control ignores repeated clicks; one list request per manual refresh while the page remains valid; 503 retains rows and retry succeeds |
| Page recovery | External deletion of matching records removes page 2; refresh returns to page 1 while retaining search and page size, for every active table |
| Keyboard | Enter/Space/ArrowDown open the menu, arrow navigation/Home/End/wrapping skip disabled choices, Enter selects, Escape restores trigger focus, Tab closes; modal focus and cancellation covered |
| Themes and responsive layouts | Drawer and menu geometry/theme assertions at 320, 768 and 1440 pixels in Light and Dark for each table; screenshots inspected |
| Access and tenant scope | Restricted-role list and preference reads rejected for all seven modules; matching foreign-tenant records excluded; preference writes did not touch the other tenant |

The main browser command is `node backend/scripts/verify-leads-table-browser.mjs <installed-playwright-module>`. It invokes `verify-table-controls.mjs` and writes its current results/screenshots to ignored `.tmp/leads-table-browser`. It requires compiled applications and an installed browser runtime. The SQL integration command is `node backend/scripts/test-polish-isolated.mjs src/modules/crm/leads/lead-polish.integration.test.ts` with a valid disposable `LEADCRM_POLISH_DATABASE_NAME`. Backend regression targets are the two preference test files, `users-search.test.ts`, and `lead-list-sorting.test.ts`.

## Files changed

Paths below are repository-relative. Generated shared JavaScript companions were regenerated by the workspace build.

| Area | Files |
| --- | --- |
| Shared contracts | `shared/src/contracts/lead-table-columns.ts`, `lead-column-migration.ts`, `module-table-columns.ts`, and their three `.js` companions |
| Backend | `backend/src/modules/administration/users/users.service.ts`; `backend/src/modules/preferences/column-registry.ts` |
| Shared toolbar and grid | `frontend/src/shared/components/crm/manage-columns-button.tsx`, `module-table-toolbar.tsx`, `module-workspace.tsx`, `refresh-button.tsx`, `table-settings-menu.tsx`; `frontend/src/shared/components/data-grid/column-header-menu.tsx`, `data-grid.tsx`, `types.ts`; `frontend/src/shared/components/manage-columns-drawer.tsx`; `frontend/src/shared/components/ui/dropdown-menu.tsx` |
| Shared state | `frontend/src/shared/constants/column-registries.ts`; `frontend/src/shared/hooks/use-column-preferences.ts`, `use-module-table-columns.tsx`, `use-table-preferences.ts` |
| Leads | `frontend/src/features/tenant/crm/leads/hooks/use-leads-data.ts`; `frontend/src/features/tenant/crm/leads/ui/leads-data-grid.tsx`, `leads-page.tsx` |
| Contacts | `frontend/src/features/tenant/crm/contacts/ui/contacts-data-grid.tsx`, `contacts-page.tsx` |
| Accounts | `frontend/src/features/tenant/crm/accounts/hooks/use-accounts.ts`; `frontend/src/features/tenant/crm/accounts/ui/accounts-data-grid.tsx`, `accounts-page.tsx` |
| Deals compatibility | `frontend/src/features/tenant/crm/deals/ui/deals-data-grid.tsx` |
| Tasks | `frontend/src/features/tenant/operations/tasks/ui/task-board.tsx`, `task-table.tsx`; `frontend/src/features/tenant/operations/tasks/use-task-columns.ts` |
| Campaigns | `frontend/src/features/tenant/marketing/campaigns/hooks/use-campaigns-data.ts`; `frontend/src/features/tenant/marketing/campaigns/ui/campaigns-page.tsx` |
| Workflows | `frontend/src/features/tenant/automation/workflows/ui/workflows-page.tsx` |
| Users | `frontend/src/features/tenant/settings/ui/team-management-users.tsx` |
| Backend tests and acceptance runner | `backend/src/modules/preferences/__tests__/lead-name-columns.test.ts`, `preferences-service.property.test.ts`; `backend/scripts/verify-leads-table-browser.mjs`, `verify-table-controls.mjs` |
| Frontend shared tests | `frontend/src/shared/components/__tests__/manage-columns-drawer-save.test.tsx`; `frontend/src/shared/components/data-grid/__tests__/column-header-menu-keyboard.test.tsx`, `hidden-columns-badge.test.ts`, `sorting-interaction.test.tsx`; `frontend/src/shared/hooks/__tests__/use-column-preferences.test.ts`, `use-table-preferences.test.ts` |
| Frontend module tests | `frontend/src/features/tenant/automation/workflows/ui/workflows-page.test.tsx`; `frontend/src/features/tenant/operations/tasks/__tests__/task-column-preferences.test.tsx`, `task-interactions.test.tsx`; `frontend/src/features/tenant/settings/ui/__tests__/team-management-users.test.tsx` |
| Verification documentation | This report, `table-controls-browser-results.json`, and supersession notes in `leads-table-search-implementation.md` and `module-table-audit.md` |

## Remaining verification limits

These flows passed with real local API/SQL data. The deployed environment was not exercised or changed. Background EventSource streams were paused in the browser harness because Playwright's forwarding interceptor buffers an infinite response; this isolates manual refresh request counts. Application streaming code remains enabled, and simultaneous provider/background-event behavior is outside that count assertion.

No manual screen-reader session or automated axe scan was performed. Keyboard, accessible names/roles/selection, focus restoration and responsive/theme behavior were checked. The full repository test suite was not rerun; the passing count above is the focused set. Every possible custom-role/record-scope/filter combination and large-tenant load profile were not exhaustively tested. The existing Users complete-directory loading pattern remains, so large-directory scalability is unchanged.
