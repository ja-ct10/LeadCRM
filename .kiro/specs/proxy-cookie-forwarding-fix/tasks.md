# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Proxy Drops Set-Cookie Headers
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate Set-Cookie headers are dropped by the proxy
  - **Scoped PBT Approach**: Scope the property to backend responses that include `Set-Cookie` headers (login, logout, OAuth callback responses)
  - Create test file `frontend/app/api/proxy/__tests__/proxy-cookie-forwarding.test.ts`
  - Mock `fetch` to simulate backend responses with `Set-Cookie` headers
  - Test that `proxyRequest` forwards `Set-Cookie` headers from backend response to browser response
  - Generate random valid `Set-Cookie` header values (varying token values, Max-Age, Path, SameSite directives)
  - Assert: for all inputs where backend response includes `Set-Cookie`, proxy response headers contain the same `Set-Cookie` values
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists: proxy only forwards `Content-Type`)
  - **EXPECTED OUTCOME**: Test FAILS — proxy response headers contain only `Content-Type`, missing `Set-Cookie` entirely
  - Document counterexamples found (e.g., login response `Set-Cookie: leadcrm_token=abc; HttpOnly; Path=/` is dropped)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Cookie Proxy Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: GET `/crm/leads` with 200 response (no Set-Cookie) returns correct status, body, Content-Type through proxy on unfixed code
  - Observe: Backend returning 404/500 error (no Set-Cookie) passes through status and body unchanged on unfixed code
  - Observe: Backend unreachable returns `{ success: false, error: { message: 'Backend unreachable' } }` with status 502 on unfixed code
  - Observe: Request forwarding preserves HTTP method, body, query params, and `X-Forwarded-For` header on unfixed code
  - Write property-based tests: for all requests where backend response does NOT include `Set-Cookie`, proxy produces same status code, same body, same `Content-Type` header as the current implementation
  - Generate random combinations of: HTTP methods (GET/POST/PUT/PATCH/DELETE), paths, status codes (200-599), response bodies, and content-types — all without Set-Cookie headers
  - Verify tests pass on UNFIXED code (confirms baseline behavior to preserve)
  - **EXPECTED OUTCOME**: Tests PASS — non-cookie responses are already handled correctly
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [ ] 3. Fix proxy cookie forwarding and backend cookie config

  - [ ] 3.1 Forward Set-Cookie headers in proxy response
    - In `frontend/app/api/proxy/[...path]/route.ts`, modify `proxyRequest` function
    - After creating the `NextResponse`, use `backendRes.headers.getSetCookie()` to get all Set-Cookie headers
    - Iterate and `response.headers.append('Set-Cookie', cookie)` for each one
    - This ensures multiple Set-Cookie headers are forwarded without collapsing
    - _Bug_Condition: isBugCondition(input) where proxyUsed=true AND backendResponse has Set-Cookie AND proxyResponse drops it_
    - _Expected_Behavior: proxy response includes all Set-Cookie headers from backend response with values preserved_
    - _Preservation: Non-cookie responses unchanged — same status, body, Content-Type_
    - _Requirements: 1.1, 2.1, 2.2, 2.3_

  - [ ] 3.2 Change sameSite from 'none' to 'lax' in production
    - In `backend/src/core/auth/auth.controller.ts`, change `COOKIE_OPTIONS.sameSite` from `(process.env.NODE_ENV === 'production' ? 'none' : 'lax')` to `'lax' as const`
    - The proxy makes browser-to-API requests same-origin, so `sameSite: 'lax'` is correct and more secure
    - Keep `secure: true` in production for HTTPS-only cookie transmission
    - _Bug_Condition: sameSite='none' is incorrect for same-origin proxy pattern_
    - _Expected_Behavior: sameSite='lax' regardless of NODE_ENV_
    - _Requirements: 1.4, 2.4_

  - [ ] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Proxy Forwards Set-Cookie Headers
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (Set-Cookie headers forwarded)
    - When this test passes, it confirms the proxy correctly forwards cookies
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Cookie Proxy Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to non-cookie responses)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm both property tests pass
  - Verify TypeScript compilation: `npm run lint`
  - Ensure all tests pass, ask the user if questions arise
