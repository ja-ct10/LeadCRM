# Workflow RBAC, Customize Fields and Deals permission verification

Verified locally on October 29, 2026. No hosted application or configured application database was changed.

## Implementation

The existing shared permission catalog, `RolePermission` storage, role editor, effective-role resolver and authorization middleware remain the single permission system.

- Workflows now have separate View, Create, Edit, Activate, Pause / Resume, Execute / Run Check, View Runs, and Delete grants. Duplicate remains independently configurable. Initial activation requires Activate; unchanged published workflows use Pause / Resume. The legacy PUT route also enforces these distinctions and cannot bypass them with `isActive` payloads.
- Execute authorizes the existing dry-run check and validation. Existing action permissions, CRM record access and tenant boundaries remain enforced. Automatic event execution retains publisher permission checks; resuming preserves the approved publisher.
- Non-archived workflows are shared with authorized tenant users instead of being limited to their creator. Campaign ownership and existing archive creator/archiver restrictions remain in place. A read-only definition entry lets operators reach Run Check without Edit permission.
- Role templates and a one-time migration provide the requested defaults. Sales Admin receives all Workflow grants. Sales Associate receives View, Execute and View Runs. The migration changes only Workflow grants on matching existing active custom roles; later RBAC edits and the existing multi-role resolution remain authoritative.
- Customize Fields now exposes enable/disable independently from editing, with version/revision checks. A field creator without layout-edit permission is no longer offered section creation. Configuration editors close when their required grant is revoked. Existing CRM editors, shared field controls, validation, identities, saved values and layouts are reused.
- The screenshot's Manage Pipeline Stages checkbox came from stale shared metadata. The current Deals page does not mount the legacy stage editor. This capability was removed from the assignable catalog and permission counts; a saved legacy flag cannot grant API access. Legacy configuration APIs remain Client Admin-only. Ordinary Deal stage changes retain `deals.edit` authorization. The legacy database column is preserved for compatibility.

## Verification results

| Check | Passed | Failed |
| --- | ---: | ---: |
| Backend unit and migration tests | 45 | 0 |
| Native PostgreSQL and authenticated HTTP integration tests | 191 | 0 |
| Frontend tests, using the latest result for each case | 274 | 0 |
| **Focused automated tests** | **510** | **0** |
| Headless Chrome acceptance scenarios | 6 | 0 |

`npm run lint`, `npm run build`, and `git diff --check` passed. The production build used the documented HTTPS API_URL as a command-scoped environment value. Generated shared JavaScript and Prisma Client are synchronized.

The integration checks cover the requested Admin/Associate workflow journeys, direct management API denials, Activate versus Pause, persisted grant/revoke changes using existing sessions, unrelated permission preservation, tenant isolation, actual automatic execution, history access, recoverable removal and existing Workflow/Campaign behavior. Customize Fields checks cover all four CRM modules, field types, required inputs, forms/Details visibility, disabled/retired values, alias stability, secure uploads, stale writes and separate configuration/record permissions.

The browser used the matching production build, authenticated API requests and a fresh native PostgreSQL database, with mock authentication/data disabled. It verified the updated Deals row, role grant/removal save and reload, custom-field creation, actual CRM inline save and reload, Associate workflow/history access, absent management controls and a successful dry run. Database assertions confirmed that the dry run changed neither its record nor execution history. There were zero page errors and zero provider sends.

Reproduce database acceptance with `node backend/scripts/test-workflow-rbac-fields.mjs`. After building, run `node backend/scripts/verify-workflow-rbac-fields-browser.mjs` for browser acceptance. Both use disposable databases and clean up their own services. Local reports and screenshots are in `data/outputs/workflow-rbac-fields/`.

## Release requirements and limits

Stop old APIs/workers, apply `20261230000000_workflow_capabilities`, and deploy matching backend/frontend/shared builds. The migration adds Pause/Execute columns, preserves existing Workflow activation/archive capabilities through their new grants, and applies the requested named-role defaults without changing other module grants.

The existing guarded deployment planner includes this migration independently of deferred CRM column retirements. Unknown migrations still fail its review gate, and deferred retirements remain excluded.

Publisher permissions remain authoritative for automatic execution. Review active publishers when removing their grants; an authorized manager must republish a workflow if its publisher no longer has the required authorization. No publisher identity or execution history was silently reassigned.

No remaining failure was found in the checked scope. Hosted deployment, production-data acceptance, and live email/SMS delivery remain unverified. Execute remains a dry run; manual live execution and per-field role rules were outside the confirmed scope. See the [API contract](../API.md) and [Customize Fields behavior](../custom-fields.md).
