# CRM organization, notes and workflow polish

Lead and Contact forms share an Organization block with exactly two modes:
Link existing account and Create new account. Linking shows only an authorized
searchable Account dropdown; an empty selection remains optional on creation.
Creating shows the shared Account Name, Industry, Size, Website, Full Address and
applicable custom fields, and saves Account and person in one sales transaction.
Account and person addresses remain independent. Standalone Full Address spans
both desktop columns and returns to one column on smaller screens.
Unchanged historical company text remains preserved when editing older records.

`POST /crm/leads`, `POST /crm/contacts`, and their corresponding
`PUT /crm/{module}/:id` routes accept optional `newAccount`:

```json
{
  "newAccount": {
    "requestId": "7c621a9a-946d-4e42-885f-61f75921f925",
    "name": "Example Company",
    "industry": "Technology",
    "size": "11-50",
    "website": "https://example.com",
    "address": "Building 1\nManila",
    "customFieldValues": {}
  }
}
```

Creation uses the collection route; updates use the record route. A nonempty
`accountId` and `newAccount` cannot be supplied together. Account View and Create
permissions are required for nested creation. Keep `newAccount.requestId` for
identical retries; use a new identity after changing the company draft. A stored
receipt rejects a different actor or payload for the same identity. Person
validation failures roll back the Account, receipt, custom values and automatic
Deals together. An ordinary company-name-only write retains its previous meaning.

Account metadata in person responses and relationship views requires Accounts
View. Existing selection and all mutations retain tenant and assignment checks.
There are no new company-profile columns on Leads or Contacts.

Drawers and full pages share the same presentation: the company appears once in
Organization, while Deal participants and Account appear in Relationships. Native
Account Notes and Internal Notes inputs are removed. Custom fields from the former
Notes group retain their IDs, values, labels, visibility and required flags in
Additional Information.

## Notes rollout

The prior `20261208000000_retire_account_fields` migration does **not** retire
internal notes. This release adds:

1. `20261209000000_account_notes_preservation`: protected historical snapshots,
   duplicate-safe Activity imports, unknown-author support for imported notes,
   custom-field layout reconciliation, affected-workflow preservation and pause.
   A trigger captures note changes from old writers during the transition.
2. `20261209010000_account_creation_receipts`: same-tenant Account creation receipts.
3. `20261210000000_retire_account_internal_notes`: separately guarded physical removal.

Normal `npm --prefix backend run db:deploy` applies preservation and receipts and
defers physical removal. Deploy matching frontend, backend and workers before
cutover. Health must advertise `accounts-activity-notes-v1`. Imported notes display
Legacy Notes or Legacy Internal Notes with full original text and explicit unknown
original authors. Account merges retain original-note provenance and move Activity
history through the existing audited relationship writer; scalar Notes is no
longer offered as a merge field. New notes remain authenticated, authored Activity entries. Import
provenance cannot be forged through normal Activity writes, and imported entries
cannot be edited or deleted through the Activity API.

For a hosted cutover, first obtain the verified restorable backup and pause old
writers. Set `DATABASE_URL` and, when applicable, `DIRECT_URL` to the same project,
user and database. Supply these environment values to the existing operator shell:

- `CRM_ACCOUNT_NOTES_EXPECT_DATABASE`: the exact database name.
- `CRM_ACCOUNT_NOTES_VERIFY_API`: serving API base ending in `/api/v1`.
- `CRM_ACCOUNT_NOTES_VERIFY_TOKEN`: a Client Admin bearer token.
- `CRM_ACCOUNT_NOTES_VERIFY_FRONTEND`: serving frontend origin.
- `CRM_ACCOUNT_NOTES_VERIFY_COMMIT`: the full matching serving release SHA.
- `CRM_ACCOUNT_NOTES_PRODUCTION_APPROVAL`, `CRM_ACCOUNT_NOTES_CUTOVER_READY`,
  `CRM_ACCOUNT_NOTES_BACKUP_VERIFIED`, and `CRM_ACCOUNT_NOTES_FRONTEND_VERIFIED`:
  each must equal that SHA after the named prerequisite is verified.

Run `npm --prefix backend run db:accounts:notes:status`, then
`npm --prefix backend run db:accounts:notes:verify`. The explicit final command is
`npm --prefix backend run db:accounts:notes:retire`. It rechecks release identity,
API contracts, migration checksums and exact note preservation before applying the
retirement migration. Other guarded retirements remain deferred. The surviving
Account `notes` column remains historical storage; the UI writes new notes through
Activity. Restart matching binaries and verify Account Activity Notes afterward.
Recovery from a physical cutover uses the verified backup and compatible release.

This implementation is verified using disposable databases. No hosted migration
is performed by the implementation or its test runners.

## Workflow run definitions

Run history renders the saved `definitionSnapshot` as Trigger, Conditions and
numbered Actions. Match all/any, enabled states, explicit settings, message content
and advanced assignment settings remain inspectable. Historical assignment
strategies are never normalized into current defaults. Reference names come from
current authorized options, with unavailable references identified explicitly.
Lookup failures leave snapshots readable. Email content uses the existing safe
HTML renderer, excluding executable content and remote resources.

See [shared CRM record views](crm-record-detail-ui.md), [Custom Fields](custom-fields.md),
and [Account field retirement](accounts-field-retirement.md) for the existing
configuration, authorization and rollout boundaries.

## Local verification

- `node backend/scripts/test-crm-polish.mjs`: authenticated HTTP acceptance with a
  fresh migration-replayed loopback PGlite database and isolated provider settings.
- Backend Vitest `account-notes-migration.integration.test.ts`: populated and empty
  migration fixtures, exact preservation, old writers and guarded retirement.
- `node --test backend/scripts/deploy-account-notes-retirement.test.cjs`: operator
  release attestations and normal-deployment deferral.
- Frontend organization, shared record-panel and workflow definition suites cover
  drafts, existing/new companies, layout, permissions and historical snapshots.
