# GitHub CI and Coolify deployment options

The selected setup uses fast checks on protected pull requests and complete
verification after merging to main. Existing Coolify Git connections and deployment
controls remain unchanged. The unused GitHub deployment workflow is disabled in
Actions because its production credentials and resource variables are unconfigured.
Full main CI verifies the release source; it cannot gate direct Coolify deployments.
The coordinated release procedure below is retained as an optional future setup.

## Verification

Both CI workflows use Ubuntu 24.04, Node 22 and npm 11.19.1.
`.github/workflows/pr-ci.yml` runs only for pull requests targeting main:

| Pull-request check | Required verification |
| --- | --- |
| Frontend — TypeScript Check | Existing frontend TypeScript command |
| Backend — TypeScript Check | Existing backend TypeScript command |
| Shared Package — TypeScript Check | Shared TypeScript and documentation links, once |
| Frontend — Tests | Complete frontend component suite |
| Backend — Tests | Backend unit, isolation, CI coordination and release regressions |
| Production Build | Shared, backend and frontend builds; unchanged generated companions |
| PR CI — Required Gate | All six evidence owners and every required job succeeded |

These jobs run independently. The lint scripts already use TypeScript, so CI does
not run a second identical lint command. Routine PR checks do not install browser
or native database tooling, run acceptance rehearsals, or build Docker images.
Their report uses `ci.profile = pr` and does not claim integration/browser coverage.

`.github/workflows/ci.yml` runs complete verification on pushes to main and supports
manual execution. It uses native PostgreSQL 18, plus the existing root-context
Docker compatibility job. The full
`npm run qa:local -- --native` command remains available locally. CI runs those
maintained checks as independent jobs, reusing one verified production build.
Both gates reject missing reports, crashes, failed commands and required skips.
Reports bind their explicit `pr` or `full` profile to the source, run and owner;
evidence from one profile cannot satisfy the other. Successful builds
must leave generated shared companions clean.
Actions are pinned to official release commits; CI has read-only repository
permissions and cancels obsolete runs for the same branch/PR.
The Actions summary lists each acceptance check and its available counts. Commands
that only report an exit status show a dash rather than an invented test count.
Profile-qualified evidence artifacts retain browser failure screenshots/text alongside
JSON reports and logs; they contain synthetic fixture data only.

| Job | Required verification |
| --- | --- |
| Documentation and static checks | Existing documentation links and workspace type/lint checks |
| Backend unit and QA safety tests | Backend tests, isolation, CI coordination and release regressions |
| Frontend component tests | Complete existing frontend component suite |
| Production build and shared contracts | Shared, backend and frontend builds; unchanged generated companions |
| Migrations, preservation and guarded startup | Migration/security regressions, populated import History, actual guarded startup and mailbox restart |
| Integration/browser acceptance matrix | Three integration and three browser shards; at most three run concurrently |
| Root-context Docker compatibility | Existing backend/frontend Docker builds and Compose validation |
| Clean checkout — build, isolated QA, native PostgreSQL | Final mandatory gate checking all jobs and complete matching evidence |

Static checks, unit tests, production builds and Docker checks run independently.
Database and acceptance jobs require the static, unit and production-build jobs
to succeed. Each acceptance shard has its own runner, temporary storage,
PostgreSQL fixtures and build directories; its browser scripts run sequentially.
Duration weights distribute suites deterministically. Newly discovered suites
receive a default weight and are included automatically.

The database job owns the populated import History integration suite, guarded
startup and mailbox restart once per CI run. Existing unsharded local acceptance
retains its complete checks. For local diagnosis, `--workspace=backend` or
`--workspace=frontend` selects unit tests and `--shard=1/3` through `3/3` selects
integration/browser suites. `--workspace` also selects frontend, backend or shared
TypeScript checks; documentation links run only with shared or an unqualified
TypeScript invocation. `--ci --profile=pr` selects the fast CI profile; omitted
profile defaults to full. An individual shard does not establish full release
acceptance. CI rejects filters, exclusions and individual-case selection.

Build archives preserve relative links within build outputs and exclude mutable
Next caches and credentials. Consumers verify the source, lockfile, suite manifest,
workflow run and archive checksum before restoring them. The final gate runs even
after dependency failure and rejects missing, duplicate, skipped, canceled or
foreign evidence. It requires the exact union of inventoried suites and all
required job results to be successful.

GitHub's failed-job rerun can reuse successful evidence and build outputs from
an earlier attempt of the same run and source. Rerun artifacts replace their own
owner's evidence. A different run, commit, lockfile or future attempt is rejected.
Initial job limits are 20 minutes for static/unit/build, 30 for database/Docker,
45 per acceptance shard and 5 for the final gate; these are cutoffs, not promised
completion times. Use the per-job summaries and retained evidence to measure
the actual critical path.

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
Nested QA launches preserve the selected npm executable without inheriting npm
credentials. Browser harnesses resolve the locked Playwright package by default;
an explicit local override remains supported. Acceptance fixtures configure their
own required closing fields, and query-driven interactions wait for the requested
search/page-size results before opening menus.
Existing governed Qualified → Won integration cases continue to verify sales
completion. Basic Lead conversion preserves Lead status and existing Deals.

Deal card action forms use a stable, session-scoped host. A realtime stage update
can move a card between columns without discarding its unsaved Deal or Task draft.
The host keeps the existing forms, cache reads and mutation services, reevaluates
record access and permissions, and clears actions on identity or route changes.
The browser regression waits for the second session's new column before checking
each draft, then verifies persisted Task associations and governed stage outcomes.

## Branch protection and optional release activation

The current required check is `PR CI — Required Gate`, bound to GitHub Actions.
Main requires up-to-date pull requests, administrator enforcement, no force pushes
or deletion, and zero mandatory human approvals. Full main CI and Docker checks
remain mandatory within the full workflow rather than required PR check names.
Changing profiles does not hide earlier failed runs or turn failures into success.

Keep `Deploy verified main to Coolify` disabled while using existing Coolify
deployment controls. The coordinator and its regression tests remain available.
No production secrets, application settings, webhooks or database settings need
changing for the fast PR setup.

Optionally activate coordinated GitHub releases only after the repair PR and full
main CI are green and a private SQL-only
restore rehearsal of an existing production backup has succeeded. A source diff
or simulated coordinator test does not prove production deployment.

1. Protect `main`: require PRs and the strict/up-to-date check named
   `PR CI — Required Gate`; enforce administrators, disallow force
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
6. Re-enable `Deploy verified main to Coolify` only after the configuration and
   private restore rehearsal are complete. Successful trusted main push CI then
   triggers the serialized release workflow. Verify its JSON outcome and both
   public revisions. A manual full CI run does not trigger a production release.

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
