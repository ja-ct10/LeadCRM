# Render import migration deployment recovery — 2026-10-04

## Cause

Render's saved Root Directory was `backend`; its Build Command was
`npm install --include=dev && npx prisma migrate deploy && npm run build`.
It did not use the repository Blueprint commands or the two-phase import runner.
The deployment applied `20261027000000_crm_import_integrity` successfully, then
attempted `20261028000000_retire_legacy_crm_imports` before the normalized backend
was deployed. The retirement verification gate rejected that order. Prisma's
follow-up statement reported an aborted transaction, masking the initial gate
error in Render's visible log. Prisma retained a failed migration attempt.

## Fix

- `backend/package.json` routes `db:deploy` through the phased runner. Normal
  deploys apply expansion and let the new server start; retirement stays a
  separate authenticated verification step. After retirement, normal migrations
  continue. Failed migrations remain errors; later releases cannot silently skip
  unapplied migrations beyond the retirement boundary.
- `db:imports:recover` checks the exact migration content, source tables, write
  guards and complete historical copy before using Prisma's supported
  `migrate resolve --rolled-back` on the failed retirement attempt. Checksums
  accept only Git LF/CRLF changes, not edited SQL. Recovery does not execute a
  destructive migration or mark an unapplied migration as applied.
- Render's saved settings must match `render.yaml`: repository-root build,
  compilation during build, phased migration deployment during start, and
  `/health`. The infrastructure migration shell script also uses `db:deploy`.
- Applied migration SQL was not edited. Historical tables stay present until
  the existing API verification and guarded retirement succeed.

## Production recovery executed

Read-only inspection confirmed expansion applied, retirement failed and all eight
source tables still present. The new shared tables contain 2 Lead jobs and 8 row
results; Contact/Account/Deal histories each contain zero jobs/results. The
database preservation function compared every historical payload successfully.

`npm run db:imports:recover` from `backend` completed successfully against the
configured production database. It marked only the failed retirement attempt
rolled back. No CRM records or historical import rows were removed or modified.
The first recovery preflight correctly stopped at a LF/CRLF checksum mismatch;
after verifying identical SQL content and adding cross-platform checksum tests,
the guarded retry succeeded.

## Verification executed

- `node scripts/test-import-deploy.mjs`: passed using native PostgreSQL 17 and
  the actual Prisma migration engine. It applied the complete preceding history,
  migrated 2 fixture jobs/8 results, reproduced the retirement failure, rejected
  recovery on changed history, recovered, repeated normal deploys, and finally
  verified retirement on the disposable fixture without losing any payloads.
  It also checks future-migration blocking and LF/CRLF checksum equivalence.
- `npm --prefix backend run build`: passed, including Prisma Client generation
  and TypeScript compilation.
- Both modified JavaScript entry points passed `node --check`.

The initial local native PostgreSQL launch was blocked by the Windows sandbox;
the approved retry outside the sandbox passed. Test clusters use local disposable
credentials, are stopped afterward, and their generated files are ignored.

## References

Recovery follows the supported [Prisma migrate resolve workflow](https://docs.prisma.io/docs/cli/migrate/resolve).
Render uses the service's saved [build/start commands](https://render.com/docs/deploys);
committing a Blueprint alone does not change a manually configured service.
