# Deal Industry retirement and CRM category selectors

Lead, Contact and Deal forms reuse `ProductInterestSelect`, the existing product
catalog hook and `CheckboxDropdownSelect`. CRM forms and product inline editors
hide only the special `__uncategorized` category filter. All configured categories,
including empty ones, come from the existing catalog. All categories still shows
historical products without a category, and saved product selections remain readable.
Campaign and Task filters and Settings Product Category management keep their
existing Uncategorized behavior.

Deal Industry is removed from create/edit forms, Details, table choices, search,
request/response adapters, shared contracts, Workflow field choices and Prisma.
Deal Details retains its Relationships section and Account link without an
Industry subtitle. Account Industry remains available in Account Create/Edit,
Details, filters, reporting and Settings. No Account value is copied into a Deal.

## Migration and read-only preflight

The new forward migration is
`backend/prisma/migrations/20261219000000_remove_deal_industry/migration.sql`.
Its only schema change is `ALTER TABLE public."Deal" DROP COLUMN "industry";`.
Every Deal Industry value is intentionally lost when it is applied. There is no
Account backfill, other column change, table recreation, reset or `CASCADE`.

Run the read-only preflight against the explicitly selected database before any
future release:

```powershell
node backend/scripts/check-deal-industry-retirement.cjs
```

It reports per-tenant Deal counts, null, empty/whitespace and populated Industry
counts, plus the kind, ID and tenant of unresolved dependencies. It exits with
code 2 when dependencies require repair. The check does not change records.
Use explicit `DATABASE_URL`/`DIRECT_URL` values for the intended environment;
an inherited or local `.env` target is not evidence of production state.

The migration repeats the same dependency query inside its transaction, with
10-second lock and 60-second statement timeouts. It blocks:

- Active Workflows and their current publications, including condition/update
  fields, changed-field rules, message variables and referenced templates.
- Queued/running Workflow execution snapshots, even for a subsequently paused rule.
- Stage entry requirements, active audience conditions, reusable templates and
  scheduled/sending Campaign configurations or content.
- Database objects depending on the column, including indexes and views.

Failures identify affected records with `DEAL_INDUSTRY_DEPENDENCIES_REQUIRE_REPAIR`.
Resolve those dependencies explicitly and repeat preflight; do not automatically
delete conditions, change stage requirements, disable rules or rewrite history.
Paused/archived definitions, old publications, completed execution snapshots,
audit/history JSON and saved UI layout metadata remain unchanged. Current field
catalogs reject retired fields, and the existing table normalizer drops obsolete
Industry column preferences when rendering Deals.

## Coordinated release

This is a breaking Deal contract/schema change. Old create/edit writers sending
`industry` receive the existing strict request validation error. Stop old frontend,
API and job-worker revisions, drain in-flight work, inspect preflight counts and
resolve blockers before a future coordinated migration/application release.
Use the existing deployment planner; it recognizes this migration while retaining
all existing unrelated retirement gates. Do not serve the old Prisma client after
the column drop or start the new client before that drop succeeds.

No production migration, reset, deployment or publication is part of this task.

## Verification

`backend/scripts/deal-industry-retirement.test.mjs` replays the migration history
into a new disposable native PostgreSQL cluster. It seeds two tenants, seven
Deals (three populated Industry values), Account Industry, an uncategorized
Product, Lead/Contact links and history. It exercises dependency rejection and
rollback, then compares every table row and schema column before/after the drop.
Only Deal Industry may disappear. This is fixture evidence, not production counts.

`verify-crm-polish-browser.mjs` exercises the real built UI and authenticated API
on its disposable database. The changed create/edit forms are checked at 320,
375, 390, 430, 768, 1024 and 1440 pixels in both themes, including category
filtering, historical products, Deal Details and Account Industry preservation.
See [system QA](verification/system-qa.md) for the existing isolated test runner.
