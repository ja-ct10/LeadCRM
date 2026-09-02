# Implementation Plan

> **STATUS: DONE & VERIFIED (2026-09-02).** The fix was implemented before this TDD cycle
> ran. Both the Set-Cookie forwarding and the sameSite correction are already in place.
> Verification tests were written after the fact and confirm the fix is correct.
> All tests pass: frontend vitest 5/5, backend tsc clean.

- [x] 1. Write bug condition exploration test
  - Bug confirmed as documented: proxy previously only forwarded `Content-Type`.
  - Fix already present in `frontend/app/api/proxy/[...path]/route.ts`:
    `backendRes.headers.getSetCookie()` + `response.headers.append('Set-Cookie', cookie)`.
  - Verification test: `frontend/app/api/proxy/[...path]/__tests__/proxy-cookie-forwarding.test.ts`
  - _Requirements: 1.1, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - Non-cookie proxy behavior verified as unchanged. Tests in the same file cover
    empty Set-Cookie arrays and property-based non-cookie responses.
  - _Requirements: 3.1–3.6_

- [x] 3. Fix proxy cookie forwarding and backend cookie config

  - [x] 3.1 Forward Set-Cookie headers in proxy response
    - **ALREADY DONE** in `frontend/app/api/proxy/[...path]/route.ts`:
      uses `getSetCookie()` and `response.headers.append('Set-Cookie', cookie)`.
    - _Requirements: 1.1, 2.1–2.3_

  - [x] 3.2 Change sameSite from 'none' to 'lax' in production
    - **ALREADY DONE** in `backend/src/core/auth/auth.controller.ts`:
      `sameSite: 'lax' as const` (unconditional).
    - _Requirements: 1.4, 2.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - All 5 tests in `proxy-cookie-forwarding.test.ts` pass.
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - Confirmed. Non-cookie property tests pass.

- [x] 4. Checkpoint — All tests pass
  - Frontend vitest: 5/5 pass (`proxy-cookie-forwarding.test.ts`).
  - Backend tsc: clean.
  - Fix verified: `getSetCookie()` present in route.ts; `sameSite: 'lax'` in auth.controller.ts.
