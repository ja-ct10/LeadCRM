# CRM archive, row actions, and detail navigation

Implemented for Leads, Contacts, and Accounts. Archive and restore use the real API and Prisma database. No deployed database was modified during this task.

## Row actions and confirmation

- Shared component: [row-actions-menu.tsx](../frontend/src/shared/components/data-grid/row-actions-menu.tsx).
- The existing body portal and fixed positioning remain. A layout effect measures the trigger and rendered menu, opens below if it fits, otherwise above, then clamps both coordinates to an 8px viewport margin.
- Scroll, resize, and menu-size changes recalculate position. Menus taller than the viewport scroll internally; the DataGrid overflow behavior is unchanged.
- Outside click, Escape (including trigger focus restoration), and action selection close the menu.
- All three grids use `onArchive`/`canArchive`, an Archive icon, and neutral styling. Existing confirmation dialogs describe removal from active views and restoration through Archived Data. Failed requests show an error rather than a success toast.
- Leads no longer expose Add Tags. The unused shared `onAddTags` option, action, and icon are removed. The nonfunctional Create Task placeholder is also removed from the Lead row menu; no replacement task feature was added. Convert remains permission-gated and Merge/Copy URL remain available where applicable.
- Lead bulk actions, full record pages, and Lead/Contact/Account side panels also use archive semantics. Contact detail/panel archive requests now target the Contact API instead of the legacy Lead service.
- Dead Lead/Account delete callbacks and local CRM restoration branches were removed from DataContext. Unrelated Deal actions retain their existing behavior.

## Exact endpoints

All six operations use **PATCH**, accept no record data, and return `{ success: true }`. Browser calls use the existing same-origin proxy. All routes below are registered in [crm.routes.ts](../backend/src/api/routes/crm.routes.ts).

| Operation | Frontend service path | Browser request path | Backend external endpoint | Controller → service |
| --- | --- | --- | --- | --- |
| Lead archive | `/crm/leads/:id/archive` | `/api/proxy/crm/leads/:id/archive` | `/api/v1/crm/leads/:id/archive` | `contacts.controller.archiveContact` → `contacts.service.archiveContact` |
| Lead restore | `/crm/leads/:id/restore` | `/api/proxy/crm/leads/:id/restore` | `/api/v1/crm/leads/:id/restore` | `contacts.controller.restoreContact` → `contacts.service.restoreContact` |
| Contact archive | `/crm/contacts/:id/archive` | `/api/proxy/crm/contacts/:id/archive` | `/api/v1/crm/contacts/:id/archive` | `contacts-v2.controller.archiveContact` → `contacts-v2.service.archiveContact` |
| Contact restore | `/crm/contacts/:id/restore` | `/api/proxy/crm/contacts/:id/restore` | `/api/v1/crm/contacts/:id/restore` | `contacts-v2.controller.restoreContact` → `contacts-v2.service.restoreContact` |
| Account archive | `/crm/accounts/:id/archive` | `/api/proxy/crm/accounts/:id/archive` | `/api/v1/crm/accounts/:id/archive` | `companies.controller.archiveCompany` → `companies.service.archiveCompany` |
| Account restore | `/crm/accounts/:id/restore` | `/api/proxy/crm/accounts/:id/restore` | `/api/v1/crm/accounts/:id/restore` | `companies.controller.restoreCompany` → `companies.service.restoreCompany` |

Backend implementation directories:

- Lead: [contacts](../backend/src/modules/crm/contacts/contacts.service.ts), using `contacts.repository.ts` and Prisma `Lead`.
- Contact: [contacts-v2](../backend/src/modules/crm/contacts-v2/contacts-v2.service.ts), using `contacts-v2.repository.ts` and Prisma `Contact`.
- Account: [companies](../backend/src/modules/crm/companies/companies.service.ts), using `companies.repository.ts` and Prisma `Account`.

Frontend services are [leadsService](../frontend/src/features/tenant/crm/leads/services/leads.service.ts), [contactsV2Api](../frontend/src/shared/services/contacts-v2.api.ts), and [accountsService](../frontend/src/features/tenant/crm/accounts/services/accounts.service.ts).

The existing `/crm/companies/:id/archive` compatibility alias remains, with a matching `/crm/companies/:id/restore` alias. Both use the Account controller, service, model, and permissions.

Archived Data uses these existing GET collection routes, with pagination:

| Module | Frontend service query | Backend endpoint |
| --- | --- | --- |
| Lead | `/crm/leads?archived=true&page=N&limit=100` | `/api/v1/crm/leads?archived=true&page=N&limit=100` |
| Contact | `/crm/contacts?archived=true&page=N&limit=100` | `/api/v1/crm/contacts?archived=true&page=N&limit=100` |
| Account | `/crm/accounts?archived=true&page=N&limit=100` | `/api/v1/crm/accounts?archived=true&page=N&limit=100` |

Query parameter order is immaterial. Contact archived querying was added to the existing list implementation; no aggregator or archive table was introduced.

## Database and security

Archive changes only the selected record: `isArchived = true`, `deletedAt = now`, and `deletedBy = authenticated user`. Restore clears those fields and resets Contact `archiveReason`. No physical deletion or cascading relationship mutation occurs.

Contact and Account reuse existing fields. Lead gains the same fields through [20261009000000_lead_archive_state/migration.sql](../backend/prisma/migrations/20261009000000_lead_archive_state/migration.sql). The migration preserves existing records and marks legacy Leads with status `Archived` as archived. It does not invent historical archive dates.

Future Lead archives preserve the original business status. A legacy Lead whose status was previously overwritten with `Archived` restores as `Inquiry`, because the prior status is unavailable. Shared response types include the archive metadata. The existing workflow Lead lookup now respects the new archive flag.

Normal list queries and their totals always require `isArchived = false`, even when a status filter is supplied. `archived=true` selects only archived records.

Authentication, tenant/workspace middleware, and the existing server environment context remain mandatory. Prisma environment scoping applies to reads and atomic state-conditional updates. Tenant identity comes from the authenticated user; payload tenant/environment values are not used. UUID validation occurs in archive/restore controllers. Missing, out-of-scope, or wrong-state records produce a standard 404; malformed IDs produce 400.

| Module | View archives | Archive | Restore |
| --- | --- | --- | --- |
| Lead / Contact | `contacts.view` | `contacts.delete` | `contacts.edit` |
| Account | `accounts.view` | `accounts.delete` | `accounts.edit` |

Restore follows the existing Deal restore permission convention. All successful archive/restore operations write the existing audit log. Tests verify 401/403 responses, cross-tenant and cross-environment rejection, state validation, persistence, and preserved relationships.

## Archived Data and navigation

[archived-data.tsx](../frontend/src/features/tenant/settings/ui/archived-data.tsx) retains the simple existing card/filter layout and displays Lead, Contact, and Account categories. It loads every page from the database-backed APIs, shows names plus email/city, and exposes loading/error/retry states. CRM archive data is not sourced from localStorage or DataContext arrays.

The existing scoped page cache keys data by tenant, user, and environment. The component revalidates on mount, focus, interval, and relevant mutations. Restore waits for the real PATCH request before refreshing and showing success. Failed restores leave the record visible. Existing cache invalidation refreshes active lists, counts, and Archived Data; mounted CRM table hooks now subscribe to those invalidations, including changes from side panels.

[route-map.ts](../frontend/src/lib/route-map.ts) resolves exact paths first, then the longest matching parent path using a `/` segment boundary. [use-layout.ts](../frontend/src/features/tenant/layout/use-layout.ts) uses this shared resolver. Both sidebar and topbar therefore retain Leads/Contacts/Accounts context for their detail URLs. Existing record-level breadcrumbs and Copy URL routes remain unchanged.

## Verification performed

Commands below were actually executed from the repository root unless otherwise specified.

```text
npm --prefix frontend run test -- src/shared/components/data-grid/__tests__/row-actions-menu.test.tsx src/lib/route-map.test.ts src/features/tenant/settings/ui/__tests__/archived-data.test.tsx src/shared/cache/__tests__/api-invalidation.test.ts src/shared/components/crm/__tests__/panel-migrations.test.tsx src/shared/components/crm/__tests__/panel-components.test.tsx src/shared/hooks/__tests__/cached-page.integration.test.tsx src/shared/components/data-grid/__tests__/sorting-interaction.test.tsx
npm --prefix backend run test -- src/modules/crm/contacts/__tests__/crm-archive.integration.test.ts src/core/auth/__tests__/security.integration.test.ts
npm --prefix frontend run lint
npm --prefix backend run lint
npm --prefix backend run db:generate
npm run build
node backend/src/tests/security-migration-replay.mjs
git diff --check
```

Also executed `npx prisma validate` from `backend/`.

- Frontend: **79 tests passed** across eight files. Includes menu direction/edges/closing, each grid's final row, archive labels, permissions, archived API loading/restoration/error handling, cache refreshes, and nested route resolution.
- Backend: **27 tests passed** across two files, including **12 CRM archive tests**. The archive tests use Prisma and authenticated HTTP against isolated PGlite PostgreSQL, not mocked repository writes.
- Frontend and backend TypeScript checks passed. Prisma generation and schema validation passed.
- Complete migration replay passed: **62 migrations**, including the new archive migration, applied to a fresh isolated database.
- Production build passed after rerunning outside the sandbox. The initial sandbox attempt failed with Windows `EPERM` while Next.js resolved the home-directory workspace root. Existing warnings concern multiple lockfiles and a local API URL in the build environment.
- Menu geometry was tested with controlled DOM measurements; no manual production-browser verification was performed.

Apply the new Prisma migration to the intended deployment database before running the updated backend. Production migration/deployment was not performed by this task.
