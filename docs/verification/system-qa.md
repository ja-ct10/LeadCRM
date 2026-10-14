# Local acceptance and release gate

Run from the repository root using the committed workspace lockfile and
`npm@11.19.1`. Local acceptance never uses application environment files, current
customer records, real provider credentials or deployment resources. The
coordinator constructs a new environment, blocks external HTTP and raw TCP/TLS calls, redirects
dotenv/Next environment loading and restricts database overrides to named
loopback fixtures. Frontend compilation permits only Google font asset hosts.
Provider mocks must intercept requests explicitly; a missing mock fails closed.
Each child receives a fresh workspace-owned TEMP/TMP/TMPDIR directory so restricted
Windows system-temp caches cannot prevent otherwise authorized local tests.
Its private-storage mount is created inside that directory and is never shared
with another suite; upload checks use the actual local storage boundary.
Install and workspace commands share a cache under the disposable checkout's
`node_modules/.cache`; Prisma on Windows otherwise resolves different engine
caches from the root and backend working directories. No existing build or engine
cache is copied into a fresh checkout.
Clean installation also uses an empty snapshot-local npm archive cache rather
than reusing the host's package downloads.

## Prerequisites and counted commands

Install with `npx --yes npm@11.19.1 ci --include=dev`, then generate Prisma with
`npm --prefix backend run db:generate`. Browser fixtures use locked Playwright;
install Chrome with `npx playwright install --with-deps chrome` (omit
`--with-deps` on Windows when system Chrome is installed). An existing runtime
may be supplied through `PLAYWRIGHT_MODULE`. Native PostgreSQL requires `initdb`,
`pg_ctl`, `psql` and `pg_config` on PATH or `POSTGRES_TEST_BIN` pointing to their
bin directory. The native helper initializes a fresh random-port loopback cluster
under ignored outputs and replays committed migrations. It never connects to the
configured application database.
Only disposable cluster initialization uses `initdb --no-sync` to avoid a slow
bootstrap flush. Before handing out the fixture, the helper verifies runtime
`fsync`, `synchronous_commit` and `full_page_writes` are all `on`; a mismatch stops
the owned cluster and fails. Native fixture records retain those settings. Current
restart/crash scenarios exercise application workers, clients and transactional
recovery; these fixtures do not establish operating-system or power-loss recovery.

The root `allowScripts` policy permits only the reviewed locked Prisma 5.22.0
client/engine installation scripts and Prisma preinstall check. npm 11 otherwise
skips these declared hooks, leaving tool/client setup to the isolated generation
gate. Installation can download locked build tooling;
runtime QA still rejects unexpected outbound traffic.

| Gate | Root command | Required evidence |
| --- | --- | --- |
| Isolation | `npm run test:qa-safety` | Env refusal, blocked external transports, successful loopback fixture |
| TypeScript | `npm run qa:typecheck` | Shared, backend and frontend all succeed |
| Unit/security/component | `npm test` | Both Vitest workspaces execute tests; passed/failed/skipped JSON counts |
| Migration preservation | `npm run test:migrations -- --native` | Prisma validate, Node rollout tests, disposable Contact preservation and populated import History HTTP rehearsal |
| SQL/HTTP/RBAC | `npm run test:integration` | Every discovered backend integration file runs on a fresh fixture; no required skips |
| Native concurrency | `npm run test:integration:native` | Native transaction, lease/cursor/idempotency contention and login race assertions |
| Production builds | `npm run qa:build` | Shared first, backend nested launcher, frontend standalone output |
| Browser/worker | `npm run test:browser` | Discovered disposable browser harnesses execute, result assertions and worker restart fixture |
| Full gate | `npm run qa:local -- --native` | Every phase succeeds; no FAIL/BLOCKED records |

For an individual suite use `npm run test:integration -- --filter=crm-completion`
or `npm run test:browser -- --filter=mailbox`. A filtered pass is evidence only for
that suite. `npm run qa:local` without `--native` deliberately exits nonzero with
a native-concurrency BLOCKED record. PGlite cannot establish simultaneous native
transaction correctness. JSON reports in `data/outputs/system-audit` list actual
counts and failures. Reports are cleared before reuse; stale JSON cannot pass a
failed invocation. Runtime errors, missing reports, absent suites, zero executed
tests and skipped required assertions fail the gate. Only non-native login
contention assertions may be skipped, and that does not satisfy native acceptance.
The full integration coordinator executes the import suite in its populated
rehearsal so the historical HTTP case runs with no conditional skip. It
retains legacy tables, checks active-module histories through authenticated HTTP and all migrated payloads (including retired DEAL jobs) through the SQL preservation verifier,
and proves altered job/result fields and invented source metadata are rejected.
On Windows, unavailable symlink privileges leave the POSIX private-storage boundary
case BLOCKED; Linux CI must execute it successfully. A skipped assertion is never
silently counted as a pass.

Each run has a unique report directory with complete command stdout/stderr logs,
arguments, Node/npm/library versions, Git revision, lockfile digest and source
SHA-256 at start/end. Mutable audit reports, private environment, build caches and
ignored QA outputs are excluded from the source digest. Changed source files are
listed and make the report invalid for final-source acceptance even if its tests
passed. A clean copy carries its explicit source inventory and revision; scripts
must not accidentally discover the parent checkout when checking the copy.

Browser fixtures cover maintained module scenarios; review their result files
instead of interpreting exit zero as complete master-brief coverage. Required
role matrix, mixed mailbox participants, session revocation, create/edit/import/
retry, rollback, archive/history, errors, navigation and 320/375/390/430/768/1024/
1440/1920 light/dark checks must have actual assertions and executed evidence.
Missing cases stay open in the system audit. UI mocks do not establish API/SQL
authorization. Native mode does not convert self-contained PGlite suites to native
PostgreSQL; their execution is identified separately and native contention needs
dedicated native assertions.
All maintained browser harnesses use an outbound URL guard and unique evidence
directories. The coordinator uses native PostgreSQL for Notifications, CRM roles,
Tasks, custom fields and the long UI suites, counts their checks and rejects empty
or missing reports. Run browser coordinators sequentially: development servers
share the workspace's `.next-dev` directory and cannot safely compile concurrently.

## Clean checkout and container compatibility

After source and generated shared companions settle, `npx --yes npm@11.19.1 run qa:clean` copies the proposed tracked
tree plus intended new source files to a fresh temporary directory, excluding
node_modules, build outputs, environment files, ignored QA data and private
storage. Use the same lockfile install, Prisma generate and full native QA gate.
Clean browser acceptance always loads the snapshot's freshly installed pinned
Playwright package; configured external browser binaries remain supported.
Record the exact source revision/diff hash, Node/npm versions, counts and output
locations. An existing dependency tree is not clean-install proof. Do not commit
changes solely to create this test directory.

Append `-- --install-only` for a clean dependency-install check; its report states
INSTALL PASS / ACCEPTANCE NOT RUN and cannot satisfy the clean build gate.
For diagnostic clean-install/typecheck/build evidence use
`npx --yes npm@11.19.1 run qa:clean -- --phases=typecheck,build`.
Its report explicitly states SELECTED PHASES PASS / FULL ACCEPTANCE NOT RUN;
the full gate remains required, including the Linux-only symlink assertion.

With a functioning Docker daemon, build from repository-root context:

```sh
docker build -f infrastructure/docker/Dockerfile.backend -t leadcrm-backend:qa .
docker build -f infrastructure/docker/Dockerfile.frontend --build-arg API_URL=https://leadcrm-build.example/api/v1 -t leadcrm-frontend:qa .
```

Inspect image paths/permissions, then run against newly provisioned disposable
PostgreSQL and dummy credentials. Verify guarded migration startup, health, auth
refusal, frontend proxy and private storage mount. Compose `config` validation
needs dummy POSTGRES_PASSWORD, BACKEND_ENV_FILE and HTTPS API_URL; it does not
prove image startup. CI performs locked clean-checkout acceptance, container
builds and Compose validation. Provider sends and production rollout are separate.

## Coolify rollout preparation and rollback

Use [Coolify production configuration](../setup/coolify-production.md) and the
existing recovery/storage runbooks. Before a later authorized rollout, capture
a tested database backup plus private-file snapshot, migration ledger/checksums,
record/junction counts, deployment SHA and reviewed provider/storage identities.
Restore the backup to a disposable rehearsal database and verify preservation
before applying the reviewed forward deployment plan. Keep old processes stopped
while migration and matching backend startup occur. Never use reset, db push or
an unreviewed bare migrate deploy. Separate retirement commands retain their
existing exact-release/API verification gates. Pipeline and Stage stay intact;
Pipeline retirement needs its own dependency inventory, data mapping, preflight,
forward migration and restore-tested rollback plan.

Deployment acceptance requires matching frontend/backend SHA, actual ledger
verification, health/release metadata, login/logout/proxy cookies, RBAC, record
creation/relationships, reports, Inbox revocation/streaming, provider callbacks
and storage read/write. Local tests cannot establish live results. Only explicitly
authorized delivery checks may contact real recipients.

Stop rollout on changed/missing historical checksums, failed migration, lost rows
or junctions, unexpected schema drift, broken auth/tenant isolation, duplicate
sends, missing private files or failed business paths. Stop new workers before
rollback. Restore the matched backup/schema/private files when an old binary is
incompatible with migrated schema; never delete migration-ledger rows. Resume
one scheduler set only, then verify health, auth, ledger, data and queued state.
Preserve uncertain provider outcomes for review rather than automatically resend.

## Evidence status

The system audit records PASS/FAIL/BLOCKED/NOT RUN with exact commands, executed
counts, source revision and limitations. The cleanup manifest records per-file
action, dependency evidence, replacements, hashes and verification. Missing
tools, network/approval restrictions or skipped coverage keep that gate open.
No production-ready or deployed claim follows from source changes alone.
