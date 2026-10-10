# Customize Fields

Settings → Customize Fields keeps the existing `custom-fields` tab ID and administration API paths. Select Leads, Contacts, Accounts or Deals, then search the compact field table. The table includes supported System fields and custom definitions, their immutable technical keys, section, Required setting, and independent Show in Forms / Show in Details controls.

## Identity and storage

The explicit shared catalog is `shared/src/contracts/field-catalog.ts`. Native technical keys come from supported CRM contracts. Custom keys are `customFieldValues.<existing-definition-id>`; renaming a label never changes its key, values, import identity, Workflow reference or Campaign token.

`ClosingFieldDefinition.definition` remains the definition store. JSON adds `groupId`, `visibleInDetails`, and retirement metadata (`deletedAt`, `deletedById`). `CustomFieldValue`, secure `RecordFile` metadata, audits, legacy Deal `closingValues`, and immutable closing snapshots retain their existing stores and identities.

Each module has one tenant-scoped `TenantPreference` with its module name and key `field-layout`. Its typed JSON contains stable section IDs, display names and order, plus native field label/presentation/order overrides. Built-in section IDs are deterministic; legacy section IDs are persisted once. Definition `group` strings remain compatibility projections of the section label. No new table or migration is needed for these JSON additions.

Only the exact IDs in `DEFAULT_CLOSING_FIELDS`, within the protected Deal closing context, are System closing definitions. A custom field with a matching display name stays Custom. Native fields and System closing definitions cannot be deleted. Types, modules and technical keys remain immutable.

## Layout and visibility

Manage Field Groups supports Add, Rename, Move up, Move down, and safe Delete within the selected module. Each module supports at most 100 groups. Names are trimmed, limited to 100 characters, and unique ignoring case. Field rows have accessible move controls for ordering within their section. New custom fields append to their selected section.

Add Group beside the field form's selector creates the section in the same module, selects it, and retains the unfinished field draft. A nonempty section can be deleted only after explicitly selecting a valid ordinary destination section; the move and deletion commit atomically. Fields and values are never cascade-deleted.

`deals:closing-evidence` is the protected closing-context ID. Its display name may change without changing closing validation. Ordinary fields cannot move into this context, closing fields cannot move out, and the protected section cannot be deleted. Legacy name-based definitions are normalized into this stable context.

The drawer and full page share `CrmRecordView`. Details combines native and custom fields in the saved module sections and order. Existing staff create/edit forms retain their original input controls and business validation while a small layout helper arranges those controls alongside custom fields. Column label overrides reuse the same configuration without adding custom table columns or changing saved column IDs.

Loaded custom values and closing evidence remain visible when a background refresh temporarily fails. An inline error offers Retry, and an open editor keeps its draft. When the existing cache clears unavailable or unauthorized data, these components remove the old values as well. Successful saves use the existing automatic cache invalidation without an additional manual refresh.

Hide affects presentation and preserves values. Disable affects operational availability. Required ordinary custom inputs cannot be hidden from forms until Required is turned off. Mandatory system inputs remain available. Required closing evidence stays enforced independently of Details visibility and is available through the closing dialog. Dropdown options used by saved values cannot be removed.

Active fields hidden from forms remain available for permitted Workflow conditions and Campaign audience/personalization reads. Workflow update actions keep their existing governed editability checks. File fields support presence conditions; Campaign personalization does not expose private file IDs or links. Public Form published snapshots remain unchanged until the Form is explicitly edited and published again.

## Deletion and history

Delete requires the separate `custom_fields.delete` action through the existing `canDelete` permission machinery. Edit permission does not grant deletion. The server rejects System deletion and checks saved Workflows, Forms (including published configuration), audience conditions, templates, and Draft/Scheduled Campaign rules/content for immutable field IDs and tokens. Rejections identify the affected saved references so they can be repaired.

Unreferenced Custom deletion retires the definition. It disappears from current configuration and new writes while the original definition, values, files, audits and frozen snapshots remain intact. Record custom-field reads retain retired definitions for historical inspection. There is no purge or restore UI.

## API

Paths below are relative to `/api/v1`; authenticated tenant scope and workspace readiness remain required.

| Method and path | Behavior | Permission |
| --- | --- | --- |
| `GET /administration/closing-requirements` | Current definitions, including disabled/hidden fields | `custom_fields.view` |
| `POST /administration/closing-requirements` | Create a definition with a stable ID | `custom_fields.create` |
| `PATCH /administration/closing-requirements/:id` | Governed definition/presentation changes | `custom_fields.edit`; active changes also require `custom_fields.disable` |
| `PATCH /administration/closing-requirements/:id` with only `{ "active": false }` | Disable a definition | `custom_fields.disable` |
| `DELETE /administration/closing-requirements/:id` | Dependency-checked retirement | `custom_fields.delete` |
| `GET /administration/closing-requirements/layout/:module` | Typed layout and resolved System/Custom catalog | `custom_fields.view` |
| `PATCH /administration/closing-requirements/layout/:module` | Add/rename/order/delete sections or change field presentation/order | `custom_fields.edit` |
| `GET /crm/:module/field-layout` | The same resolved layout for CRM readers/editors | Any of module view/create/edit |
| `GET /crm/:module/custom-fields` | Current ordinary module definitions; excludes closing context | Any of module view/create/edit |
| `GET /crm/:module/:id/custom-fields` | Definitions, retained values, section layout and secure file metadata | Module view |
| Existing record `POST`/`PUT` endpoints | Optional `customFieldValues` keyed by definition ID | Existing module create/edit |
| `POST /crm/deals/batch` | Validates/stores values per new Deal in the existing transaction | `deals.create` |
| `POST /crm/:module/custom-field-uploads?name=...&type=...` | Pending uploader-owned secure file bytes | Module create |

Layout PATCH accepts a strict single command:

```json
{ "action": "add", "label": "Project information" }
{ "action": "rename", "groupId": "<stable-id>", "label": "Site information" }
{ "action": "moveGroup", "groupId": "<stable-id>", "direction": "up" }
{ "action": "delete", "groupId": "<stable-id>", "moveToGroupId": "<destination-id>" }
{ "action": "field", "technicalKey": "email", "label": "Work email", "visibleInDetails": true }
{ "action": "field", "technicalKey": "customFieldValues.<id>", "direction": "down" }
```

Definition types remain Text (1,000 characters), Long Text (10,000), finite Number, real `YYYY-MM-DD` Date, configured Dropdown, and File Upload. Files require successful persistent tenant/record-owned uploads, use the existing MIME/signature checks, and are limited to 10 MB. Pending files remain scoped to their module/uploader and expire after 24 hours. Definition count and submitted value count remain capped at 100 per module/request. Null clears an optional editable field; omitted values remain unchanged.

## Verification

Focused service tests cover immutable identity, native label overrides, stable section rename/order, required/mandatory hiding guards, closing-context protection, safe section deletion, hidden-field Workflow read availability, dependency-checked retirement, retained values, and used-option rejection. Frontend tests cover combined native/custom sections, no duplicate rendering, independent Details hiding, retained drafts, and existing custom-field/Contact/inline Deal saving behavior.

Run the isolated migration and authenticated API checks from the repository root:

```sh
node backend/scripts/test-custom-fields.mjs
```

The harness creates fresh in-memory PGlite databases, replays forward migrations, and starts a temporary loopback PostgreSQL socket for Prisma. It never uses a deployment database. Restricted test environments must permit child processes and local loopback connections; a Prisma `P1001` before the first assertion indicates the local connection was blocked, not a completed API check. On Windows, use a writable `TEMP`/`TMP` directory if the test runner cannot write its transform cache.

The implementation acceptance run passed all 11 authenticated HTTP tests, including saved section rename/order/safe deletion, mandatory input protection, explicit Delete permissions, Workflow/template dependencies, retirement with retained values, secure upload ownership, module/tenant isolation, and unchanged frozen closing evidence. Migration replay passed both the standard order and deferred relationship-compatibility retirement; definition IDs/count/version, normalized values and original closing JSON/snapshots were preserved. SQL tenant foreign keys and module/record association constraints passed separately.

The focused field service suite (`backend/src/modules/crm/closing-requirements/field-layout.test.ts`) passed seven tests, including rejection at the group limit without corrupting the saved layout. The Customize Fields settings suite passed ten tests covering module search, System/Custom actions and permissions, independent visibility, group controls and Add Group draft preservation. The existing record custom-field, Contact save, inline Deal, and closing-requirement frontend suites passed 23 tests across four files, including transient-error value/draft retention and cleared-cache hiding. These checks use isolated data and mocked storage/providers. They do not establish live provider delivery or deployment readiness. Current release-wide lint/build results and concrete environment limitations belong in the implementation delivery report.

See the [architecture guide](ARCHITECTURE.md), [API guide](API.md), and [closing behavior](engagement-deal-creation.md) for surrounding contracts and release migration prerequisites.
