# Six-migration CRM column retirement

This operator applies exactly the six existing migrations below. It introduces
no schema migration and does not change their SQL or normal startup deferrals.
All fifteen removed properties are already absent from the compatible Prisma
schema. `Account.notes`, canonical product links, ownership, permissions,
relationships, custom fields, audit records and historical automation survive.

| Order | Existing migration | Removed columns |
| --- | --- | --- |
| 1 | `20261110000000_retire_unused_crm_columns` | Contact.lastContactedAt, qualifiedAt, disqualifiedReason; Deal.billingFrequency |
| 2 | `20261112000000_retire_lead_nonform_columns` | Lead.description, website, productInterestOther |
| 3 | `20261129000000_retire_contact_obsolete_columns` | Contact.customerType, recordType, score, linkedinUrl, activeProducts |
| 4 | `20261130000000_remove_contact_job_title` | Contact.jobTitle |
| 5 | `20261210000000_retire_account_internal_notes` | Account.internalNotes |
| 6 | `20261227000000_retire_account_notes_and_tags` | Account.tags; guarded repeat of internalNotes removal |

## Compatibility and preservation

Use `backend/scripts/deploy-crm-columns-retirement.cjs --plan` for the read-only
ledger, checksum, schema and dependency preflight. `--verify` additionally checks
the exact serving frontend/backend SHA and authenticated Lead, Contact, Account
and Deal reads using existing Client Admin identity and normal RBAC.

The audit distinguishes entity-qualified fields from unrelated User/Profile,
Lead, Deal and custom fields with similar names. It checks active Workflow
selectors, changed-field conditions, inline and referenced template tokens,
active audience conditions, executable Campaigns and database dependencies.
Existing preservation triggers are the only explicitly migration-owned trigger
exceptions. Inactive definitions remain historical data. The dependency audit
also recognizes [PostgreSQL 18's cataloged NOT NULL attributes](https://www.postgresql.org/docs/18/catalog-pg-constraint.html)
only when they are local, uninherited constraints on one approved retired
column. These attributes leave with that column, just like its default. Other
constraints, surviving-column NOT NULL attributes, and inherited constraints
continue to block retirement. Retained-schema comparisons exclude only those
intrinsic retired-column attributes.

Account reconciliation
must be a no-op for Workflow state, saved layouts and custom-field definitions;
the operator refuses to pause or rewrite them to permit a drop.

The operator appends exact current Contact captures, including original update
and archive state and product/Deal links. Job Title uses a separate snapshot in
the existing immutable history table so it cannot invalidate the older Contact
migration's JSON equality guard. Lead archival custom values and Account note
history are checked exactly, including empty strings. Populated legacy CRM
columns or nonempty Account tags still block the unchanged migrations. No
automatic nulling, reinterpretation of purchases, or data deletion is allowed.

Row fingerprints cover public business/security data and FK descendants, with
only the fifteen retired columns removed from comparisons. Session rows are
excluded from the business baseline; any temporary verification session must
expire promptly and be revoked. Existing history rows and Activities cannot
change. Only validated legacy-note Activity additions and append-only archive
captures are permitted during preservation. Schema fingerprints compare retained
columns, constraints, indexes, functions, triggers, effective grants, RLS and
role attributes. Explicit/default ACL representations are normalized using
[PostgreSQL's access-privilege functions](https://www.postgresql.org/docs/current/functions-info.html).

## Maintenance and recovery

The API and dedicated notification worker accept a private `SIGUSR2` control
file at the container's temporary directory:

```json
{"action":"pause","commit":"<exact serving SHA>","deadline":"<UTC ISO timestamp>"}
```

The file is `leadcrm-crm-retirement-maintenance.json`; protect it with mode 0600.
The deadline must be in the future and at most ten minutes away. Send the signal
to the verified application Node PID, not an npm/shell process. A `.status` file
is written by the application only after requests and every background writer,
including session/import cleanup, have drained. New mutations, public tracking
links and provider operations return 503. Existing authentication and RBAC remain
in force for the small passive-read allowlist. Expired/idle identities are never
accepted and their sessions are not mutated during maintenance.

`CRM_RETIREMENT_MAINTENANCE_UNTIL` provides the same bounded startup behavior.
After role restoration, `{"action":"resume","commit":"<SHA>"}` followed by the
same signal restores normal operation early. At the deadline the application
checks the runtime connection and resumes only once its read-only fence is off.

An independent PostgreSQL-container watchdog must preserve/restore the original
runtime-role setting, cancel/terminate only identified cutover sessions before
reopening writes, and recycle runtime connections. Prisma migration sessions
use application name `leadcrm_crm_columns_migration` and a 60-second process
bound. Each new migration requires at least 90 seconds remaining. Keep automatic
recovery independent of the browser/operator shell. Never automatically restore
production data or reverse a successful migration.

## Operator inputs and execution

Set process-local `CRM_COLUMNS_` inputs: `EXPECT_DATABASE`, `VERIFY_COMMIT`,
`VERIFY_API`, `VERIFY_FRONTEND`, `VERIFY_TOKEN`, `DEADLINE` and `BACKUP_EVIDENCE`.
Existing `DATABASE_URL` is the runtime connection; `DIRECT_URL` is the private
migration connection to the same host/database. `PRODUCTION_APPROVAL`,
`BACKUP_VERIFIED`, `FRONTEND_VERIFIED` and `WRITERS_STOPPED` must equal the verified
SHA. They attest reviewed evidence; they do not implement a write pause.

The protected backup-evidence JSON records `database`, `commit`, `backupSha256`,
`restored: true`, `snapshotDigest` and `retiredDigest`. The latter also fingerprints
all retired values, nulls and original Contact capture metadata. Generate this
evidence only after a fresh real archive
has been restored and compared using exported `snapshot`/`schemaSnapshot` helpers
against the correct PostgreSQL database. Keep backups in the PostgreSQL container,
not the application filesystem. Verify the paused live snapshot still matches.

`crm-columns-operator-session.cjs --verify|--retire` obtains a short-lived normal
session for an existing eligible Client Admin and revokes it in `finally`; it
never prints a token or changes a user's permissions. The standalone operator
also accepts an already authorized token through its environment.

For a production-data rehearsal, use `rehearse-crm-columns-retirement.cjs` only
against a private `leadcrm_crm_columns_restore_YYYYMMDDHHMMSS` database. It requires
the real restored baseline and read-only runtime connection, starts the actual
compiled HTTP app on container loopback without schedulers, and runs the same
guarded operator and authenticated checks. HTTP verification is permitted only
on loopback; remote verification still requires HTTPS. It cannot target `leadcrm`.

```sh
node backend/scripts/deploy-crm-columns-retirement.cjs --retire
```

The operator requires actual runtime `transaction_read_only=on`, matching live
maintenance/drain status, a verified backup baseline, and an exclusive operator
lock. Before each step it refreshes checksums, ledger, schema and dependencies.
Staged Prisma deployment includes complete applied history and only one approved
pending migration. Release comments follow real authenticated checks and restore
their prior values on failure. No successful application is re-executed.

Unexpected pending migrations, unresolved failed receipts, partial schema state,
preservation failures and changed baselines stop execution for investigation.
There is no migration-history repair or automatic retry. After partial success,
retain successful receipts and obtain a fresh restore-tested baseline before
continuing with the remaining named migrations.

## Validation and reporting

Run `node --test backend/scripts/deploy-crm-columns-retirement.test.cjs`, the
maintenance Vitest suites and `npm --prefix backend run test:crm:columns` with
`POSTGRES_TEST_BIN` set to the installed native PostgreSQL tools. The native
rehearsal creates an isolated cluster, restores a real backup, exercises populated
and archived values, interrupts after two actual Prisma applications, refreshes
the restored baseline, and completes the remaining four. It verifies exact
retained data/schema/security, repeat execution, tenant scoping, blocked writes
and normal authenticated writes after recovery. No provider send is part of QA.

Also run workspace TypeScript/lint/build checks and affected CRM, import/export,
merge/conversion, Campaign, Workflow and permission regressions. Follow the
existing [production release workflow](../setup/ci-coolify-release.md).

Independent production acceptance must verify all six receipt checksums, absence
of the fifteen columns, surviving Account.notes and note trigger, exact retained
data/history/security, original write settings, authenticated endpoints, worker
recovery and logs. Report each migration with PASS/FAIL/BLOCKED/NOT TESTED and
its initial state, dependencies, preservation/backup evidence, actual execution
command, deployed SHA, receipt/checksum and remaining blocker. A local rehearsal
or successful image build is not production cutover evidence.
