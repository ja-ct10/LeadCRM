# GitHub CI and Coolify deployment options

## Current verification

[The active CI workflow](../../.github/workflows/ci.yml) runs on pull requests to `main`, pushes to `main`, and manual dispatch. It has read-only repository permissions and no production credentials or deployment step.

| Check | Scope |
| --- | --- |
| Frontend — TypeScript Check | Next route types and frontend contracts |
| Backend — TypeScript Check | Backend application contracts |
| Shared Package — TypeScript Check | Shared API and validation contracts |
| Frontend — Unit Tests | Existing isolated component and unit suite |
| Backend — Unit Tests | Existing isolated backend unit, QA isolation, CI coordination, release coordinator regressions, and development watcher reload check |

The unit jobs use Ubuntu and the existing `npm test` harness. This executes the storage symlink regression that Windows skips. A configured workflow is not evidence of a successful run: review the actual results for the proposed commit.

At the last verified GitHub protection read on 2026-10-16, the three TypeScript checks above were required, with an up-to-date branch and administrator enforcement. This change adds unit jobs without changing remote branch protection. The historical `PR CI — Required Gate` workflow is absent; do not describe it as an active check.

CI does not currently run production builds, database migrations, integration journeys, browser acceptance, or Docker compatibility. Those checks remain available locally and their evidence must be reviewed separately before release:

```sh
npm run qa:typecheck
npm test
npm run qa:build
npm run test:integration:native
npm run test:browser
npm run qa:database
```

Use the existing filters documented in [the functional fix verification notes](../plans/functional-audit-fixes.md) for diagnosis. A selected suite is not evidence that the complete inventory passed. QA must use disposable loopback databases, synthetic data, empty provider credentials, and the existing outbound network guard.

Browser fixtures use [the shared acceptance context](../../backend/scripts/verify-browser-matrix.mjs). It blocks service workers from bypassing API interception. Fixtures displaying opaque sandboxed email frames use its explicit `sandboxedFrames` option, which still blocks service-worker registration. See [Playwright network isolation guidance](https://playwright.dev/docs/network#missing-network-events-and-service-workers).

## Deployment remains manual

There is no `.github/workflows/deploy-production.yml` in the active checkout. [The release coordinator](../../scripts/deploy-coolify.mjs) and its simulated regression tests remain available, but neither constitutes a production deployment or backup/restore rehearsal. The regression suite checks that CI exposes no deployment credentials when that workflow is absent.

Do not enable automatic release merely because TypeScript or unit checks pass. A future release workflow needs explicit activation, complete build/database/browser evidence, protected trusted-main dispatch, production-only scoped credentials, serialized releases, exact serving revision checks, and a private SQL restore rehearsal. Production secrets and database contents must remain outside public artifacts.

Use the existing Coolify controls for an authorized release. Before deploying the functional fixes, follow the migration compatibility and writer-quiescence requirements in [the functional fix notes](../plans/functional-audit-fixes.md) and [production recovery guidance](coolify-production-recovery.md). No automatic migration reversal, production restore, provider send, or payment is part of local verification.

Report production deployment, provider delivery/webhook checks, and private backup restoration separately until each has actually been verified.
