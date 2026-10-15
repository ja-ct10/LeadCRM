# Account assignment and product field retirement

Accounts represent companies. Create/edit/details, columns, filters, CSV mapping,
merge and Customize Fields no longer expose assignment, Product Interest, or
Active Products. Account actions require their existing module permissions in
the authenticated tenant. Assignment on Leads, Contacts, Deals and Tasks remains
governed by its existing rules.

The shared catalog retains the stable Basic Information and Address group IDs.
The later [CRM polish release](crm-polish.md) consolidates the historical Notes
group into Activity and moves its custom fields to Additional Information. Custom definitions from retired sections move to Additional Information;
their IDs, values, required flags and visibility remain intact. Saved layouts and
table preferences cannot restore retired native fields. Old Account field input
and import mappings are rejected rather than silently treated as a successful edit.

Saved workflows with retired Account references are paused, retaining their
definitions and execution history. The API explains the repair requirement and
activation stays blocked until repaired. Contact/Lead/Deal assignment and Task
assignee configuration remain supported. Product catalogs and related sales
records are preserved.

## Coordinated release and preservation

Stop old APIs/workers before deploying the matching release. Normal guarded
`db:deploy` applies `20261207000000_account_field_preservation`, captures historical
Account values/product links and affected configuration in protected, append-only
`crm_history` tables, reconciles layout metadata and pauses affected workflows.
It removes Account ownership from database deactivation guards while retaining
the other modules' guards. Normal startup **defers**
`20261208000000_retire_account_fields`.

Deploy matching backend, frontend and workers. The release must serve capability
`accounts-field-retirement-v1`; frontend `/api/release` and backend `/health` must
report the exact verified SHA. Verify login, Account CRUD/relationships, permissions,
imports, healthy workflows and paused workflow repair before physical cutover.

## Separate operator cutover

Use the backend commands `db:accounts:fields:status`,
`db:accounts:fields:verify` and `db:accounts:fields:retire`.
Status and verify do not write database data. Provide:

- `DATABASE_URL` and `CRM_ACCOUNT_FIELDS_EXPECT_DATABASE` naming that exact database.
  If `DIRECT_URL` is configured, it must name the same database. Verification and
  migration use that direct connection together.
- `CRM_ACCOUNT_FIELDS_VERIFY_API` ending in `/api/v1`, a Client Admin bearer token
  in `CRM_ACCOUNT_FIELDS_VERIFY_TOKEN`, and `CRM_ACCOUNT_FIELDS_VERIFY_FRONTEND`.
- `CRM_ACCOUNT_FIELDS_VERIFY_COMMIT`: the full serving release SHA.
- For retirement, each of `CRM_ACCOUNT_FIELDS_PRODUCTION_APPROVAL`,
  `CRM_ACCOUNT_FIELDS_CUTOVER_READY`, `CRM_ACCOUNT_FIELDS_BACKUP_VERIFIED`, and
  `CRM_ACCOUNT_FIELDS_FRONTEND_VERIFIED` must equal that SHA.

Before supplying those attestations, obtain explicit production authorization,
verify a restorable database backup, and pause all writers. The command verifies
both releases, the Account response contract and applied migration checksums. It
recaptures historical values and sets the short-lived release marker required by
the retirement migration. Physical removal locks the source records, verifies
exact preservation, removes the Account product junction and retired columns,
and clears the marker. No `CASCADE` is used to discard unknown dependencies.

Restart only matching binaries and verify health, CRUD, links and workflow status.
Stop on preservation/checksum mismatch, remaining columns or any failed acceptance.
Rollback requires the matched backup and compatible release; never restart an old
binary against retired columns or remove migration-ledger rows.

Fresh disposable fixtures can apply physical retirement without an operator marker
only when no Account records exist. Populated migration tests verify rejection
without a marker, immutable history and preservation of archived/nullable data.
