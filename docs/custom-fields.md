# Customize Fields

Settings → Customize Fields keeps the existing `custom-fields` tab ID and administration API paths. Select Leads, Contacts, Accounts or Deals, then search the compact field table. The table includes supported System fields and custom definitions, their immutable technical keys, section, Required setting, and independent Show in Forms / Show in Details controls.

## Identity and storage

The explicit shared catalog is `shared/src/contracts/field-catalog.ts`. Native technical keys come from supported CRM contracts. Custom definitions keep their canonical IDs and gain an immutable `technicalAlias`, displayed as `customFieldValues.<alias>`. The catalog also exposes `canonicalTechnicalKey` and `customFieldId`. Existing UUID keys remain supported; renaming a label or section changes neither identity nor alias.

`ClosingFieldDefinition.definition` remains the definition store. JSON includes `technicalAlias`, `groupId`, `visibleInDetails`, and retirement metadata (`deletedAt`, `deletedById`). `CustomFieldValue.fieldId`, secure `RecordFile` metadata, audits, legacy Deal `closingValues`, and immutable closing snapshots retain their existing stores and identities. Aliases resolve only against definitions already scoped to the caller's tenant and module. Disabled/hidden fields still obey the consumer's existing read/write rules.

Alias allocation uses lowercase ASCII letters/digits and hyphens, a 64-character limit, deterministic numeric collision suffixes, and reserved-name checks. Canonical IDs and retired aliases remain reserved within each module. All application definition/layout writes acquire a tenant-scoped configuration row lock through Prisma inside the existing serializable transaction with bounded conflict retries. There is no second mapping table or JSON-only pre-save uniqueness assumption. Direct database writers must use the same locking/allocation protocol.

Each module has one tenant-scoped `TenantPreference` with its module name and key `field-layout`. Its typed JSON contains stable section IDs, display names/order, a revision (legacy layouts start at zero), and native field presentation overrides. Built-in section IDs are deterministic; legacy section IDs are persisted once. Definition `group` strings remain compatibility projections of the section label. No new SQL table or migration is needed for these JSON additions.

Only the exact IDs in `DEFAULT_CLOSING_FIELDS`, within the protected Deal closing context, are System closing definitions. A custom field with a matching display name stays Custom. Native fields and System closing definitions cannot be deleted. Types, modules and technical keys remain immutable.

## Layout and visibility

Manage Fields Groups uses the shared Dialog, a synchronized module selector, compact cards, leading drag grips, pencil rename and trash confirmation. Each module supports at most 100 groups. Names are trimmed, limited to 100 characters, and unique ignoring case. Field rows also have leading drag grips and pencil edit buttons. Both use the existing dnd-kit stack with mouse/touch PointerSensor and keyboard sorting. Sorting fields stays within their current group and is disabled during search. New custom fields append to their selected section.

Each completed reorder submits one complete permutation in one API request. Missing, duplicate, foreign or cross-group identities are rejected. The server commits order and audit together; stale revisions return HTTP 409. The UI blocks overlapping mutations, restores authoritative order on failure, and refreshes configuration. The mobile header uses the existing Deals gear and CreateButton (Plus-only below 640px) with a horizontal, readable title at 320px. Search reuses ModuleSearchInput and includes readable/legacy keys, labels, groups and field metadata.

Add Group beside the field form's selector creates the section in the same module, selects it, and retains the unfinished field draft. A nonempty section can be deleted only after explicitly selecting a valid ordinary destination section; the move and deletion commit atomically. Fields and values are never cascade-deleted.

`deals:closing-evidence` is the protected closing-context ID. Its display name may change without changing closing validation. Ordinary fields cannot move into this context, closing fields cannot move out, and the protected section cannot be deleted. Legacy name-based definitions are normalized into this stable context.

The drawer and full page share `CrmRecordView`. Details combines native and custom fields in the saved module sections and order. Existing staff create/edit forms retain their original input controls and business validation while a small layout helper arranges those controls alongside custom fields. Column label overrides reuse the same configuration without adding custom table columns or changing saved column IDs.

Ordinary custom Details rows use the same `InlineEditRows` interaction as native fields. Active visible definitions appear even without a stored value, using “—”; click the value to edit and Save/Cancel within that row. The shared typed controls support Text, Long Text, Number, Date, Dropdown and authorized File Upload. Each write supplies only that canonical field ID, with null for an optional clear. Hidden-in-forms and saved disabled/retired values stay read only. One custom-state query serves the record; no standalone bulk Details editor remains. `DealClosingRequirements` keeps its specialized evidence controls, progress, validation and governed closing behavior.

Loaded custom values and closing evidence remain visible when a background refresh temporarily fails. An inline error offers Retry, and an open editor keeps its draft. When the existing cache clears unavailable or unauthorized data, these components remove the old values as well. Successful saves use the existing automatic cache invalidation without an additional manual refresh.

Hide affects presentation and preserves values. Disable affects operational availability. Required ordinary custom inputs cannot be hidden from forms until Required is turned off. Mandatory system inputs remain available. Required closing evidence stays enforced independently of Details visibility and is available through the closing dialog. Dropdown options used by saved values cannot be removed.

Active fields hidden from forms remain available for permitted Workflow conditions and Campaign audience/personalization reads. Workflow conditions/actions accept readable and canonical references; the existing builder read adapter maps readable references to its canonical options without rewriting stored Workflow JSON. Campaign audience editors display readable options for old UUID rules without silently changing saved criteria. Campaign validation, recipient projections and preview samples support both token formats. Workflow updates keep their existing governed editability checks. File presence checks remain supported without exposing private file IDs/links in Campaign personalization. Public Forms use separate published field IDs and supported native mapToField targets; this change preserves those snapshots and does not add unsupported custom mapping. CRM CSV imports/exports retain their existing supported column contracts.

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
| `PATCH /administration/closing-requirements/layout/:module` | Add/rename/reorder sections or change field presentation/order | `custom_fields.edit` |
| The same layout PATCH with `action: "delete"` | Atomic section deletion and reassignment | `custom_fields.delete` |
| `GET /crm/:module/field-layout` | The same resolved layout for CRM readers/editors | Any of module view/create/edit |
| `GET /crm/:module/custom-fields` | Current ordinary module definitions; excludes closing context | Any of module view/create/edit |
| `GET /crm/:module/:id/custom-fields` | Definitions, retained values, section layout and secure file metadata | Module view |
| Existing record `POST`/`PUT` endpoints | Optional `customFieldValues` keyed by canonical ID or supported alias; duplicate identity representations rejected | Existing module create/edit |
| `POST /crm/deals/batch` | Validates/stores values per new Deal in the existing transaction | `deals.create` |
| `POST /crm/:module/custom-field-uploads?name=...&type=...` | Pending uploader-owned secure file bytes | Module create |

Layout PATCH accepts a strict single command:

```json
{ "action": "add", "label": "Project information" }
{ "action": "rename", "groupId": "<stable-id>", "label": "Site information" }
{ "action": "reorderGroups", "groupIds": ["<every-group-id-in-final-order>"], "expectedRevision": 3 }
{ "action": "reorderFields", "groupId": "<stable-id>", "technicalKeys": ["<every-field-key-in-this-group>"], "expectedRevision": 3 }
{ "action": "delete", "groupId": "<stable-id>", "moveToGroupId": "<destination-id>" }
{ "action": "field", "technicalKey": "email", "label": "Work email", "visibleInDetails": true }
{ "action": "field", "technicalKey": "customFieldValues.age", "visibleInDetails": true, "expectedRevision": 3 }
```

New reorder commands require `expectedRevision`; other commands accept it for old-client compatibility. New UI mutations always supply it. Definition edits also accept `expectedVersion` and `expectedRevision`; callers cannot assign/change `technicalAlias`, canonical ID, module or type. Legacy moveGroup/direction commands remain accepted for compatible older clients.

Definition types remain Text (1,000 characters), Long Text (10,000), finite Number, real `YYYY-MM-DD` Date, configured Dropdown, and File Upload. Files require successful persistent tenant/record-owned uploads, use the existing MIME/signature checks, and are limited to 10 MB. Pending files remain scoped to their module/uploader and expire after 24 hours. Definition count and submitted value count remain capped at 100 per module/request. Null clears an optional editable field; omitted values remain unchanged.

## Metadata rollout

Version 1 backfill processes all definitions (including retired ones) in createdAt/ID order and writes only missing technicalAlias properties. Predefined System closing aliases equal their established IDs. Normal application configuration reads perform the same idempotent backfill under the configuration lock; Workflow/Campaign validation reads do not initialize or mutate definitions.

The maintenance script defaults to a read-only plan. After reviewing the plan and production backups, an authorized operator may apply it to one explicitly selected tenant with an active tenant Admin actor:

```sh
cd backend
node -r ts-node/register scripts/custom-field-aliases.ts --tenant <tenant-id>
node -r ts-node/register scripts/custom-field-aliases.ts --apply --tenant <tenant-id> --actor <active-tenant-admin-id>
```

The applying transaction verifies hashes of stored CustomFieldValue rows and closing history before/after and attributes one audit per nonempty backfill. Existing aliases are never recomputed. Stop on ambiguous preexisting metadata. Deploy matching backend/frontend/shared revisions; database schema changes and destructive synchronization are unnecessary for this feature.

## Verification

Focused service tests cover immutable identity, native label overrides, stable section rename/order, required/mandatory hiding guards, closing-context protection, safe section deletion, hidden-field Workflow read availability, dependency-checked retirement, retained values, and used-option rejection. Frontend tests cover combined native/custom sections, no duplicate rendering, independent Details hiding, retained drafts, and existing custom-field/Contact/inline Deal saving behavior.

Run the isolated migration and authenticated API checks from the repository root:

```sh
node backend/scripts/test-custom-fields.mjs
```

The harness creates fresh in-memory PGlite databases, replays forward migrations, and starts a temporary loopback PostgreSQL socket for Prisma. It never uses a deployment database. Restricted test environments must permit child processes and local loopback connections; a Prisma `P1001` before the first assertion indicates the local connection was blocked, not a completed API check. On Windows, use a writable `TEMP`/`TMP` directory if the test runner cannot write its transform cache.

Current test counts, responsive artifacts, baseline failures, rollout status and proof boundaries are recorded in the [implementation report](verification/customize-fields-2026-10-11.md). Isolated data, local browser evidence and mocked providers do not establish production readiness.

See the [architecture guide](ARCHITECTURE.md), [API guide](API.md), and [closing behavior](engagement-deal-creation.md) for surrounding contracts and release migration prerequisites.
