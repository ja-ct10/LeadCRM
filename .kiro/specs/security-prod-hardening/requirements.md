# Requirements: Security & Production Hardening (C3)

> **STATUS: IMPLEMENTED & VERIFIED (2026-09-02)**
> Audit finding C3. All code changes applied, lint + 163/163 tests pass.

## Problem

The C3 findings from the security audit — all confirmed:

1. **OTP `000000` bypass gated only by env vars** — `verifyRegistrationOtp` accepted the code `"000000"` when `DEV_OTP_BYPASS=true` OR `DEMO_MODE=true`, with no `NODE_ENV` guard. If either var was accidentally set in production, any user could verify their email with a static code.
2. **Email-verification skip gated only by env vars** — `loginUser` skipped the `emailVerified` check when `DEV_OTP_BYPASS=true || DEMO_MODE=true && status=ACTIVE`, same missing `NODE_ENV` guard.
3. **Weak default admin password** — `demo.seed.ts` fell back to `admin123` when `SYSTEM_ADMIN_PASSWORD` was not set, with no production guard. This password is committed in `backend/.env` and documented in `render.yaml`.
4. **`DEV_OTP_BYPASS=true` committed in `backend/.env`** — any fresh clone ran with the OTP bypass enabled.

## Requirements

### R1 — OTP bypass cannot activate in production
1.1 The `verifyRegistrationOtp` OTP `"000000"` bypass SHALL only be reachable when `NODE_ENV !== 'production'`.
1.2 Even if `DEV_OTP_BYPASS=true` or `DEMO_MODE=true` is set in a production environment, the bypass SHALL be structurally unreachable at runtime.

### R2 — Email-verification skip cannot activate in production
2.1 The `loginUser` email-verification skip SHALL only apply when `NODE_ENV !== 'production'`.
2.2 The condition SHALL fail closed in production — unverified users are always blocked.

### R3 — Seeder refuses weak password in production
3.1 `seedDemoAccounts` SHALL throw a descriptive error (not a silent skip) when `NODE_ENV === 'production'` AND `SYSTEM_ADMIN_PASSWORD` equals the default `'admin123'`.
3.2 The error message SHALL explain the requirement and where to set the strong password.

### R4 — Committed env default is safe
4.1 `backend/.env` (committed) SHALL have `DEV_OTP_BYPASS=false` so fresh clones do not start with auth verification disabled.

## Acceptance criteria
- `auth.service.ts loginUser`: `isDevBypassAllowed = process.env.NODE_ENV !== 'production' && (DEV_OTP_BYPASS || DEMO_MODE)`.
- `auth.service.ts verifyRegistrationOtp`: same `NODE_ENV !== 'production'` gate before `isDemoBypass`.
- `demo.seed.ts`: throws in production if password is default `'admin123'`.
- `backend/.env`: `DEV_OTP_BYPASS=false`.
- Backend `tsc --noEmit` clean, 163/163 tests pass.
