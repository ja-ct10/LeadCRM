# Verified GitHub CI and Coolify releases

The intended release sequence is protected PR → both CI checks → merge → both
main CI checks → tested SHA pinned in both Coolify applications → backend
deployment and release health → frontend deployment and public verification.
The application database remains a separate running Coolify resource.

## Verification

`.github/workflows/ci.yml` uses Ubuntu 24.04, Node 22, npm 11.19.1 and native
PostgreSQL 18, plus the existing root-context Docker compatibility job. The full
`npm run qa:local -- --native` suite runs the maintained contracts, integration,
migration and real browser harnesses. Missing reports, crashes and required skips
remain failures. Successful builds must leave generated shared companions clean.
Actions are pinned to official release commits; CI has read-only repository
permissions and cancels obsolete runs for the same branch/PR.

Linux fixture environments allocate private short directories directly under
`/tmp`, independent of checkout depth and inherited TMPDIR. Windows keeps
workspace-owned temporary directories. Native PostgreSQL listens only on loopback
TCP with Unix sockets disabled in its owned configuration file. Runtime fsync,
synchronous_commit and full_page_writes must all be enabled. Startup failures
retain server diagnostics under `data/outputs/system-audit/postgres`; shutdown
targets only the owned data directory and preserves logs before cleanup.

The native startup rehearsal replays real migrations with Prisma ledger checksums,
populates synthetic CRM/history, invokes the actual `db:deploy` npm command,
verifies the reviewed additive migration and deferred columns, rejects an
unreviewed migration in a private release copy, and starts the built backend.
The fixture has no application credentials and blocks external provider traffic.
Existing governed Qualified → Won integration cases continue to verify sales
completion. Basic Lead conversion preserves Lead status and existing Deals.

## Activation checklist

Activate only after the repair PR has both green CI checks and a private SQL-only
restore rehearsal of an existing production backup has succeeded. A source diff
or simulated coordinator test does not prove production deployment.

1. Protect `main`: require PRs, strict/up-to-date checks named
   `Clean checkout — build, isolated QA, native PostgreSQL` and
   `Root-context Docker compatibility`; enforce administrators, disallow force
   pushes/deletion and allow zero required human approvals for the sole owner.
2. Create the GitHub `production` environment with a custom deployment branch
   policy allowing only branch `main`, no tags. No PR/fork receives its secrets.
3. Create two team-bound Coolify API tokens: configuration `read` + `write`, and
   deployment `deploy` only. Neither needs `root` or `read:sensitive`. Store only
   in production secrets `COOLIFY_CONFIG_TOKEN` and `COOLIFY_DEPLOY_TOKEN`.
   Keep database/provider/application secrets exclusively in Coolify.
4. Set the following production environment variables, verified against the
   existing resources. UUIDs below are the audited resource identities, not seeds.
5. Disable **Deploy on push** in both applications. Preserve Git sources,
   Nixpacks, build/start commands, domains, private networks and persistent storage.
   Keep SOURCE_COMMIT available at runtime. Do not save unrelated UI edits.
6. Merge the green PR. Successful trusted main CI automatically triggers the
   serialized release workflow. Verify its JSON outcome and both public revisions.

| Variable | Audited value |
| --- | --- |
| COOLIFY_URL | `https://coolify.lead-crm.tech` |
| COOLIFY_BACKEND_UUID | `ul2i77dyydgvdcrc7zpppay2` |
| COOLIFY_FRONTEND_UUID | `xkqgxlfv3g6xb39hbzyp3an1` |
| COOLIFY_DATABASE_UUID | `yvwx3pvmetfgrhrtlckck2wn` |
| COOLIFY_BACKUP_UUID | `d9vyfxfl56s1nqm9mpydlvuj` |
| COOLIFY_BACKUP_TIMEOUT_SECONDS | `3600` |
| RELEASE_API_URL | `https://api.lead-crm.tech` |
| RELEASE_FRONTEND_URL | `https://lead-crm.tech` |

## Runtime coordination

`deploy-production.yml` accepts only this repository's successful `push` CI runs
for `main`. The coordinator rechecks the GitHub run, full checkout SHA and latest
main revision before dispatch. A superseded candidate is skipped. Production
concurrency is serialized with cancellation disabled; main moving after backend
dispatch does not interrupt that pinned backend/frontend pair.

The coordinator validates existing application identities, Nixpacks/Git settings
and disabled direct auto-deploy, then PATCHes only `git_commit_sha` and reads both
saved pins back. Deployment POSTs target only the two application UUIDs. There
is no database start/stop/deploy endpoint, SQL, reset, retirement override or
production database credential in Actions. Existing backend guarded startup
remains the only migration mechanism.

When migration files differ from the last successful backend release, the existing
backup schedule is triggered with **only** `{ "backup_now": true }`. This retains
its timing and retention. A new successful execution is required; an old backup
cannot pass the gate. Production archives/SQL/record data never enter CI artifacts.

Healthy matching deployments and matching queued deployments are reused on reruns.
An uncertain webhook response is reconciled through new deployment UUIDs and the
tested SHA; it is never blindly POSTed again. Other in-flight releases block
dispatch. Requests are bounded to 30 seconds, polls to 10-second intervals,
deployments to 20 minutes each, and backup waits to the configured timeout.

Backend success requires Coolify status `finished` and exact production
`/api/v1/health` commit. Frontend follows only then and requires status `finished`,
exact uncached `/api/release` commit, `/login` success and matching
`/api/proxy/health`. The public frontend release endpoint exposes only
`{ status, commit, env }` from runtime SOURCE_COMMIT.

## Failure and recovery

The JSON artifact and Actions summary contain the failed phase, known deployment
UUIDs and observed serving SHAs. They exclude tokens, raw API bodies, application
environment variables, backup filenames and database contents. A partial release
is failed. Frontend failures leave the successfully deployed backend revision
visible for diagnosis; backend failures stop frontend deployment. Coolify retains
its last healthy containers when its deployment fails.

Fix the reported cause through a protected PR and passing CI, or rerun the same
successful main release after resolving infrastructure configuration. No automatic
migration reversal or production restore occurs. Database restoration and older
binary rollback require separate compatibility/recovery review; see
[production recovery](coolify-production-recovery.md).

For the private restore rehearsal, restore one existing archive into a uniquely
named disposable database inside private infrastructure, with SQL clients only.
Verify restoration exit status, migration ledger, expected CRM/history tables and
consistency; never start CRM workers against the clone. Remove only that named
clone after the recorded verification. Keep the archive outside public artifacts.

API contracts were checked against Coolify v4.4.6 source and official docs:
[external CI deployments](https://coolify.io/docs/applications/deployments/automatic-deployments),
[partial application update](https://coolify.io/docs/api/endpoints/applications/update-application-by-uuid),
[v4.4.6 routes](https://github.com/coollabsio/coolify/blob/v4.4.6/routes/api.php),
[PostgreSQL Ubuntu packages](https://www.postgresql.org/download/linux/ubuntu/).

Activation, backup restoration and a coordinated production release must be
reported separately from local/PR test results until they have actually occurred.
