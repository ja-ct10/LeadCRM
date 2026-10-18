# Product Category management

Implemented from upstream main `f2bbf069f8b108dd009d4ba4a9c4c816d381a80a` on
`codex/manage-product-categories` in the attached isolated worktree. Existing
uncommitted quotation work in the primary checkout was not changed. This report
describes local source and disposable verification, not a production deployment.

## Behavior and component reuse

- The Product category control reuses the `Settings` icon and Tooltip primitives
  from Manage Field Groups. Its accessible label is “Manage Product Categories”;
  its tooltip is “Manage Categories”.
- The feature-local manager uses existing `Dialog`, header/title/close behavior,
  `Input`, `Label`, `Button`, `panelInputClass`, typography, bordered group-row
  styling, scrolling and category-count footer. No new shared component was added.
- Add and inline rename trim names, reject blank names and case-insensitive
  duplicates, and share the existing 200-character/control-character validation.
  Rename provides prefilled input, Save and Cancel. Failures retain entered values.
- Delete uses the existing red `Trash2` destructive styling and
  `ConfirmActionDialog` with its destructive confirmation and inline errors.
- The existing native Category select and Product drawer remain in place.
  Category is required for both create and edit. Existing Uncategorized Products
  remain unchanged until an edit is saved with an available category.

## Storage, API and integrity

- `ProductInterest.category` remains the Product assignment field. The existing
  `TenantPreference` table stores the one available-category list under module
  `product-interests`, key `categories`. On first access it is initialized from
  actual nonblank categories on active and archived Products. Subsequent reads use
  that persisted list, including when it is empty. No schema migration is needed.
- `PATCH /administration/product-interests/categories` accepts the shared
  add/rename/delete command described in [API reference](API.md). It returns the
  existing catalog response with `meta.categories`.
- The manager and Product editor's inline Add category flow use the same category
  add endpoint and validation. Inline entry remains part of the existing form:
  Save Product first adds its category, then saves the Product. If Product saving
  fails, the newly saved category remains available for retry.
- Successful mutations publish the existing `product-interests-changed` event.
  Its committed catalog response immediately updates category options and the
  Products table; existing focus/refresh handling revalidates server state.
- Rename updates matching category text on active and archived same-tenant
  Products in the existing serializable sales transaction. Product IDs, names,
  amounts, archive state and Deal relationships remain intact.
- Backend deletion checks all Products, including archived Products, and returns
  409 with “This category cannot be deleted because it is currently assigned to
  one or more products.” No Product is cleared or deleted.
- Creation and every Product edit validate category membership on the backend.
  A partial edit that omits category validates the saved category, so an
  Uncategorized Product cannot bypass classification through a direct PATCH.
- Category add, rename and delete reuse `products.create`, `products.edit` and
  `products.archive`, respectively, in both UI and route authorization. The tenant
  comes from authentication. Category audit records commit with the mutation.
  No new RBAC permission, table, event transport or category module was introduced.

## Verification

| Check | Result |
| --- | --- |
| Focused frontend: Product/category manager, Product editor, existing Products settings | 35 tests passed |
| Backend Product validation and existing quotation contract tests | 26 tests passed |
| Native PostgreSQL category persistence/API/RBAC/integrity/concurrency | 12 scenarios passed |
| Self-contained PGlite version of the category suite | The same 12 scenarios passed |
| Workspace lint/typecheck | All three workspaces passed |
| Final backend test typecheck | Passed |
| Production workspace build | Shared, backend and frontend passed; 180 frontend pages generated |
| Production frontend responsive API-fixture preview | 28 layout checks passed across 320/375/390/430/768/1024/1440px |
| Diff whitespace check | Passed |

Database scenarios cover initialization, unused-category persistence, blank and
duplicate rejection, capitalization-only rename, active/archived assignments,
Product IDs/values and existing Deal snapshot preservation, in-use deletion,
required category validation, action-specific permissions, unauthorized requests,
tenant isolation, simultaneous duplicate additions and Product-create/delete races.
The native fixture uses separate PostgreSQL connections for the concurrency checks.

Browser checks exercise actual rendered gear ordering, modal open/close, add,
inline rename, computed red trash color, delete confirmation, blocked deletion,
updated Product options and inline category/Product creation at every requested
width. They also check horizontal overflow, control visibility, long-name wrapping,
scrolling and the count footer. These are isolated API fixtures; database security
and persistence are established separately by the database/API suites.

Reproduce with:

```powershell
npm --prefix frontend test -- src/features/tenant/settings/ui/product-categories.test.tsx src/features/tenant/settings/ui/product-editor-merge.test.tsx src/features/tenant/settings/ui/product-interests-settings.test.tsx --maxWorkers=1
npm --prefix backend test -- src/modules/administration/product-interests/product-interests.validation.test.ts src/modules/marketing/campaigns/__tests__/quotations.test.ts --maxWorkers=1
node backend/scripts/test-product-categories-postgres.mjs
npm --prefix backend test -- src/modules/administration/product-interests/product-categories.integration.test.ts --maxWorkers=1 --silent
npm run lint
npm run build
node backend/scripts/preview-product-categories.mjs
git diff --check
```

The native fixture requires PostgreSQL tools; it owns and cleans its disposable
cluster and does not use the application's configured database. The browser
preview requires a completed production frontend build and system Chrome.
The production build used process-only `API_URL=https://leadcrm-build.example/api/v1`,
`LEADCRM_QA_BUILD_ASSETS=1` and `NEXT_TELEMETRY_DISABLED=1`.
Screenshots and counted results are in the ignored
`data/outputs/system-audit/product-categories` directory. No production migration or deployment
was performed. Full repository-wide test suites were not run.

## Files changed

- `backend/src/api/routes/administration.routes.ts`
- `backend/src/modules/administration/product-interests/product-interests.controller.ts`
- `backend/src/modules/administration/product-interests/product-interests.service.ts`
- `backend/src/modules/administration/product-interests/product-interests.validation.test.ts`
- `backend/src/modules/administration/product-interests/product-categories.integration.test.ts`
- `backend/scripts/test-product-categories-postgres.mjs`
- `backend/scripts/preview-product-categories.mjs`
- `frontend/src/features/tenant/settings/ui/products-page.tsx`
- `frontend/src/features/tenant/settings/ui/manage-product-categories.tsx`
- `frontend/src/features/tenant/settings/ui/product-editor.tsx`
- `frontend/src/features/tenant/settings/ui/product-categories.test.tsx`
- `frontend/src/features/tenant/settings/ui/product-editor-merge.test.tsx`
- `frontend/src/features/tenant/settings/ui/product-interests-settings.test.tsx`
- `frontend/src/shared/hooks/use-product-interests.ts`
- `shared/src/contracts/product-interests.contract.ts`
- `shared/src/contracts/product-interests.contract.js` (generated by the shared build)
- `docs/API.md`
- `docs/product-category-management.md`
