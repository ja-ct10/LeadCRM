# Implementation Plan: Security & Production Hardening (C3)

> **STATUS: DONE & VERIFIED (2026-09-02)**
> All tasks completed. Backend tsc clean, 163/163 tests pass, monorepo lint 3/3 clean.

- [x] 1. Add `NODE_ENV !== 'production'` guard to `loginUser` email-verification bypass
  - `backend/src/core/auth/auth.service.ts` loginUser — changed `isDemoMode` to `isDevBypassAllowed`
    with `process.env.NODE_ENV !== 'production'` as a hard structural gate before the env-var checks.
  - _Requirements: R2_

- [x] 2. Add `NODE_ENV !== 'production'` guard to `verifyRegistrationOtp` OTP bypass
  - `backend/src/core/auth/auth.service.ts` verifyRegistrationOtp — same guard pattern on `isDemoBypass`.
  - `"000000"` bypass structurally unreachable in production regardless of env var values.
  - _Requirements: R1_

- [x] 3. Add production password guard to `demo.seed.ts`
  - `backend/src/database/seeders/demo.seed.ts` — throws descriptive error when
    `NODE_ENV === 'production'` AND `SYSTEM_ADMIN_PASSWORD === 'admin123'`.
  - Error message explains the requirement and where to set the correct value.
  - _Requirements: R3_

- [x] 4. Set `DEV_OTP_BYPASS=false` in `backend/.env`
  - Changed from `true` to `false` in the committed dev env file.
  - Local developers who need the bypass can re-enable it in their own `.env` without committing.
  - _Requirements: R4_

- [x] 5. Final gate — `tsc` + tests + monorepo lint
  - Backend `tsc --noEmit`: exit 0.
  - `vitest --run`: 163/163 pass (24 test files).
  - `turbo run lint`: 3/3 workspaces clean.
