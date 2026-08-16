# ADR-001: Shared Package Exports Raw TypeScript Source

## Status

Accepted

## Date

2026-08-16

## Context

The `@leadcrm/shared` package provides types, constants, API contracts, and Zod validation schemas consumed by both `frontend` and `backend` workspaces. A decision was needed on whether to pre-compile the shared package (outputting `.js` + `.d.ts`) or export raw `.ts` source directly.

## Decision

The shared package exports raw TypeScript source files:
- `"main": "./src/index.ts"`
- `"types": "./src/index.ts"`

Both frontend (via bundler module resolution + paths) and backend (via Node16 module resolution + paths) resolve to the raw source. No build step exists for the shared package.

## Alternatives Considered

1. **Pre-compiled with declarations** — Would require a build step for shared, project references in consumers, and rebuild-on-change workflow. Rejected due to DX friction in a small team.

2. **TypeScript project references** — Attempted but incompatible with `tsc --noEmit` lint workflow (requires pre-built declaration files to exist). Rejected.

## Consequences

**Positive:**
- Zero build step for shared package — instant type feedback
- Single source of truth for types (no stale `.d.ts`)
- Simple `npm run lint` across all workspaces

**Negative:**
- Backend `tsconfig.json` cannot use `rootDir: "./src"` in the main config (resolved source is outside rootDir). Removed rootDir; build output lands at `dist/backend/src/server.js`.
- Backend start script references nested path: `node dist/backend/src/server.js`
- If shared package grows large, may need pre-compilation for build performance

## Migration / Rollout

Already in production. If pre-compilation becomes necessary:
1. Add `tsc` build step to shared package
2. Update `"main"` and `"types"` to point at `dist/`
3. Remove `paths` overrides in consumer tsconfigs
4. Add shared build to CI and turbo dependency graph

## Related

- `shared/tsconfig.json` — no rootDir, no composite
- `backend/tsconfig.json` — paths mapping to `../shared/src/index.ts`, no rootDir
- CI workflow runs `tsc --noEmit` in each workspace independently
