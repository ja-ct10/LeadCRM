# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing the fix)
  - **Property 1: Bug Condition** - Verified, Onboarded Login User Reaches the Dashboard
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists across both defects (contract mismatch + silent blank screen)
  - **Scoped PBT Approach**: The bug is deterministic given the scenario; scope the property to the concrete failing cases in the `isBugCondition` domain (`enteredVia='login'` verified+onboarded; `authPhase='resolving'`; `authInitFailed=true`)
  - Backend — **Login contract shape**: For a verified, onboarded user, assert the `POST /auth/login` response `user` object contains `emailVerified` and `onboardingCompletedAt` (from Bug Condition in design). Target `loginUser` in `backend/src/core/auth/auth.service.ts` and `login` in `backend/src/core/auth/auth.controller.ts`. **EXPECTED**: FAILS — fields absent
  - Backend — **Login vs me parity**: Assert the login `user` shape equals the `GET /auth/me` `user` shape for the same user (compare against `me` in `backend/src/core/auth/auth.controller.ts`). **EXPECTED**: FAILS — shapes diverge
  - Frontend — **Guard misroute**: Feed the unfixed thin login payload (no gate fields) into `AuthGuard`'s gate evaluation (`frontend/src/shared/providers/auth-guard.tsx`) and assert a verified, onboarded user is NOT redirected to `/verify-email` or `/onboarding`. **EXPECTED**: FAILS — misroutes on falsy `undefined` gate fields
  - Frontend — **Silent blank screen**: Assert `AuthGuard` renders a loading indicator (not `null`) while `isLoading` is true. **EXPECTED**: FAILS — returns `null`
  - Frontend — **Auth-init failure (edge)**: Simulate `authApi.me()` throwing during `restoreSession` in `frontend/src/store/AuthContext.tsx` and assert an error/recovery state is exposed rather than a silent `user = null` blank screen. **EXPECTED**: FAILS — failure is swallowed to `user = null`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bug exists)
  - Document counterexamples found (login response missing `emailVerified`/`onboardingCompletedAt`; `AuthGuard` returns `null` while resolving and on auth-init failure)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing the fix)
  - **Property 4: Preservation** - Non-Buggy Auth Scenarios Are Unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on the UNFIXED code first, then encode it
  - **Non-bug condition**: all `X` where `isBugCondition(X)` returns false (invalid credentials, logged-out redirect, genuine unverified, genuine not-onboarded, System Admin, logout, OAuth, mock-mode)
  - Observe on UNFIXED code and record outputs:
    - Invalid credentials → error toast + stays on `/login`, no redirect
    - Logged-out navigation to `/dashboard` → redirect to `/login` with intended path saved in `sessionStorage`
    - Genuinely unverified user → routes to `/verify-email`
    - Genuinely not-onboarded user → routes to `/onboarding`
    - System Admin → routes to `/admin/dashboard`, gates bypassed
    - Logout → auth state cleared + cookie/session revoked + returns to `/login`
    - Google OAuth → NextAuth flow completes + hydrates via `/auth/me`
  - Write a **property-based test** over the `AuthScenario` domain (`emailVerified × onboardingCompletedAt × role × status × enteredVia`): for every scenario where `isBugCondition(X)` is false, assert the fixed `AuthGuard` decision equals the original guard decision (from Preservation Requirements in design)
  - Write example tests capturing each observed non-bug case above
  - Backend — assert `loginUser` still throws `401`/`403` for invalid credentials, unverified, and inactive users (guards unchanged)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix for auth login blank screen (contract mismatch + silent null renders)

  - [x] 3.1 PRIMARY — Align the login response contract with `/auth/me` (backend)
    - In `loginUser` (`backend/src/core/auth/auth.service.ts`): widen the user lookup to include the tenant relation fields `me` already selects (`tenant.name`, `tenant.onboardingStep`, `tenant.onboardingCompletedAt`, `tenant.industry`, `tenant.companySize`) and the user's `emailVerified`
    - Return the aligned user shape: add `emailVerified`, `onboardingStep`, `onboardingCompletedAt`, `tenantName` to the returned `user` object; do NOT change token issuance, session creation, or the verification/status guards
    - In `backend/src/core/auth/auth.controller.ts`: extract a shared `buildAuthUserResponse(user, tenant)` flatten helper used by BOTH `me` and the `login` response construction so the two payloads are guaranteed identical in shape
    - _Bug_Condition: isBugCondition(X) where X.enteredVia='login' AND X.emailVerified<>null AND X.onboardingCompletedAt<>null AND X.role<>'System Admin'_
    - _Expected_Behavior: expectedBehavior — login `user` shape equals `/auth/me` `user` shape (Property 1, Property 3)_
    - _Preservation: guards for invalid/unverified/inactive users and token/session/cookie mechanics unchanged (Property 4)_
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 3.2 SECONDARY — Re-hydrate after login + add auth-init error state (AuthContext)
    - In `login()` (`frontend/src/store/AuthContext.tsx`): after a successful `authApi.login(...)`, call `authApi.me()` and `setUser` from that canonical payload (defense-in-depth); fall back to the now-complete login payload if the `me` call fails
    - Add explicit `authError` state; in `restoreSession`, distinguish "no session" (401 → `user = null`, no error) from a genuine `/auth/me` transport failure (set `authError`)
    - Expose `authError` and a `retryAuthInit` action through the context; leave business logic and mock-mode (`NEXT_PUBLIC_USE_MOCK_AUTH`) behavior unchanged
    - _Bug_Condition: isBugCondition(X) where X.authInitFailed=true AND X.rendersNull=true_
    - _Expected_Behavior: stored user always carries gate fields; auth-init failure surfaces recovery state, not silent null (Property 2, Property 3)_
    - _Preservation: mock-mode localStorage flow and logout behavior unchanged (Property 4)_
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.3 SECONDARY — Replace silent `null` with visible states in AuthGuard
    - In `frontend/src/shared/providers/auth-guard.tsx`: while `isLoading`, render a full-screen loading state (reuse the existing `animate-spin` spinner pattern with dark-mode classes and an `aria-label`) instead of `null`
    - When `authError` is set, render an explicit error state with a retry action (wire to `retryAuthInit`) or redirect to `/login`, instead of `null`
    - For `user === null`, keep the redirect to `/login` but render the loading state during the brief redirect rather than `null`
    - Leave gate logic (verification, onboarding, System Admin, saved-redirect, role-based default) unchanged
    - _Bug_Condition: isBugCondition(X) where X.authPhase='resolving' AND X.rendersNull=true_
    - _Expected_Behavior: visible loading OR error OR redirect to /login, never a silent blank screen (Property 2)_
    - _Preservation: routing decisions for all non-buggy scenarios unchanged (Property 4)_
    - _Requirements: 2.2, 2.3_

  - [x] 3.4 SECONDARY — Extract shared AuthLoadingScreen and use it in route shells
    - Extract a small shared `AuthLoadingScreen` component (colocated under `shared/components` or `shared/providers`) rendering the identical visible spinner used by `AuthGuard`
    - Replace `return null` during auth resolution with `<AuthLoadingScreen />` in `frontend/app/page.tsx`, `frontend/app/onboarding/page.tsx`, and `frontend/app/company-setup/page.tsx`
    - Leave redirect logic and navigation handlers in those shells unchanged
    - _Bug_Condition: isBugCondition(X) where X.authPhase='resolving' AND X.rendersNull=true_
    - _Expected_Behavior: all four auth surfaces render a visible spinner instead of a blank screen (Property 2)_
    - _Preservation: redirect/navigation behavior of each shell unchanged (Property 4)_
    - _Requirements: 2.2, 2.5_

  - [x] 3.5 Backend unit tests for aligned shape and unchanged guards
    - Assert `loginUser` returns the aligned `user` shape (includes `emailVerified`, `onboardingStep`, `onboardingCompletedAt`, `tenantName`) for a verified, onboarded user
    - Assert `login` and `me` produce identical `user` shapes via the shared `buildAuthUserResponse` helper
    - Assert `loginUser` still throws `401` for invalid credentials and `403` for unverified/inactive users (guards unchanged)
    - _Requirements: 2.1, 2.4, 3.1, 3.3_

  - [x] 3.6 Frontend unit tests for visible states and route shells
    - Assert `AuthGuard` renders a loading state while `isLoading`, an error state on `authError`, and redirects to `/login` when `user === null` — never `null`
    - Assert root / `onboarding` / `company-setup` shells render `<AuthLoadingScreen />` instead of `null` during resolution
    - _Requirements: 2.2, 2.3_

  - [x] 3.7 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Verified, Onboarded Login User Reaches the Dashboard
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior; when they pass, they confirm the bug is fixed
    - Run all bug condition exploration tests from task 1
    - **EXPECTED OUTCOME**: Tests PASS (login contract includes gate fields; login==me parity; guard no longer misroutes; guard shows loading not null; auth-init failure surfaces recovery state)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 4: Preservation** - Non-Buggy Auth Scenarios Are Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run the preservation property-based test and example tests from task 2
    - **EXPECTED OUTCOME**: Tests PASS (invalid credentials, logged-out redirect, genuine unverified/not-onboarded, System Admin, logout, OAuth, mock-mode all unchanged; guard decision parity holds for all non-buggy scenarios)
    - Confirm all tests still pass after the fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Integration tests for full flow parity
  - Full credentials-login flow (real-API mode): verified, onboarded user logs in → lands on `/dashboard` with no blank frame; then refresh → same `/dashboard` (Property 3)
  - Auth-init failure flow: force `authApi.me()` to fail → user sees an explicit error/recovery UI, not a blank screen; `retryAuthInit` recovers
  - OAuth flow regression: Google sign-in completes and hydrates via `/auth/me` unchanged
  - _Requirements: 2.1, 2.3, 2.4, 3.7, 3.8_

- [x] 5. Checkpoint - Ensure all tests pass and verification succeeds
  - Ensure all exploration, preservation, unit, and integration tests pass
  - Run `npm run lint` (turbo type-check across all workspaces) — must pass
  - Run `npm run build` (builds all workspaces) — must pass
  - Ask the user if questions arise
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Phase 2 — Remaining Routing and UX Defects (RC-05 through RC-12)

- [x] 6. Write bug condition exploration tests for Phase 2 (BEFORE implementing fixes)
  - **Property 1: Bug Condition** - Routing Defects and UX Gaps (RC-05, RC-06, RC-07, RC-08/09, RC-10, RC-11, RC-12)
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples for each remaining root cause before touching any implementation
  - **Scoped PBT Approach**: Each scenario is deterministic; scope properties to the concrete failing case per root cause
  - **RC-05 — Seeded account gated by emailVerified = null**:
    - Read the `demo.seed.ts` and `seeder.seed.ts` upsert blocks; assert every `create` object includes `emailVerified: new Date()`. **EXPECTED**: FAILS — field is absent in at least one upsert
    - Render `AuthGuard` with a user object where `emailVerified = null`, `status = 'ACTIVE'`; assert it does NOT call `router.replace('/verify-email')`. **EXPECTED**: FAILS — guard redirects because `null` is falsy
  - **RC-06 — System Admin routed to /dashboard via saved redirect**:
    - Set `sessionStorage.setItem('leadcrm_redirect_after_login', '/dashboard')` and render `AuthGuard` with `user.role = 'System Admin'`; assert `router.replace` is called with `/admin/dashboard`, NOT `/dashboard`. **EXPECTED**: FAILS — saved `/dashboard` redirect passes the `!isAdminPath` gate and System Admin is mis-routed
  - **RC-07 — Invited user sent to /onboarding when tenantName is set**:
    - Render `AuthGuard` with a user where `tenantName = 'Acme Corp'`, `onboardingCompletedAt = null`, and `localStorage` has no onboarding key; assert it does NOT call `router.replace('/onboarding')`. **EXPECTED**: FAILS — current gate only checks `!tenantName`, but fails for users where tenantName is empty string; test an empty string scenario too
  - **RC-08/09 — Backend unreachable → silent blank or unhelpful error**:
    - Stub `authApi.me()` to throw `new TypeError('Failed to fetch')` in `restoreSession`; assert `authError` message mentions network/connectivity (not a generic auth message). **EXPECTED**: FAILS — current message is generic `'Unable to verify your session'`
  - **RC-10 — Login page manually navigates after login() success (race condition)**:
    - Read the login page component; assert it does NOT call `router.push(...)` or `router.replace(...)` with any path after `login()` returns `true`. **EXPECTED**: FAILS if manual navigation is present (code inspection test)
  - **RC-11 — login() returns false when me() throws (confirmed NOT a bug in current code)**:
    - Stub `authApi.me()` to throw after a successful `authApi.login()` response; assert `login()` returns `true` and `user` is set from the login payload. **EXPECTED**: PASSES on current code (RC-11 already resolved — this confirms the fix)
  - **RC-12 — Infinite redirect loop**:
    - Simulate the no-session → guard → login → guard cycle; assert it terminates (user settles on one route) rather than looping. **EXPECTED**: PASSES on current code (RC-12 already resolved — this confirms the fix)
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: RC-05, RC-06, RC-07, RC-08/09, RC-10 tests FAIL; RC-11 and RC-12 tests PASS (confirming already-resolved roots)
  - Document counterexamples found for each failing scenario
  - Mark task complete when tests are written, run, and results are documented
  - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 7. Write preservation property tests for Phase 2 (BEFORE implementing fixes)
  - **Property 2: Preservation** - Non-Buggy Auth Scenarios Unchanged by Phase 2 Fixes
  - **IMPORTANT**: Follow observation-first methodology — observe on UNFIXED code first, then encode
  - **Non-bug condition for Phase 2**: all scenarios where RC-05 through RC-12 do NOT apply
  - Observe and record on UNFIXED code:
    - Genuinely unverified user (`emailVerified = null`, `status != 'ACTIVE'`) → routes to `/verify-email`; must remain
    - System Admin with saved redirect to `/admin/settings` (a valid admin path) → follows that redirect; must remain
    - Regular tenant user with saved redirect to `/crm/leads` → follows that redirect; must remain
    - Non-invited user with no `tenantName` and no local flag → routes to `/onboarding`; must remain
    - Auth-init 401 response → `authError` remains null, `user = null`, redirects to `/login`; must remain
    - Successful login with working `me()` call → `login()` returns `true`, user populated; must remain
    - Google OAuth flow → unchanged; mock-auth mode → unchanged
  - Write a **property-based test** over the AuthGuard routing domain: for every scenario where none of the Phase 2 bug conditions hold, assert the fixed `AuthGuard` routing decision equals the pre-fix routing decision
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (baseline behavior confirmed before any Phase 2 changes)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 8. Fix for Phase 2 routing and UX defects

  - [x] 8.1 Fix emailVerified = null on seeded and demo accounts (RC-05)
    - In `backend/src/database/seeders/demo.seed.ts`: add `emailVerified: new Date()` to the `create` and `update` blocks of every user upsert (all ACTIVE seeded users)
    - In `backend/src/database/seeders/seeder.seed.ts`: apply the same `emailVerified: new Date()` fix to any ACTIVE user upserts present
    - Add an idempotent DB patch so existing running databases also get the fix without requiring a re-seed:
      ```sql
      UPDATE "User" SET "emailVerified" = NOW()
      WHERE status = 'ACTIVE' AND "emailVerified" IS NULL;
      ```
      Implement this as either a Prisma migration (preferred) or a one-time conditional upsert at the top of the seed entry point
    - Do NOT change the `AuthGuard` email-verification gate logic — the fix is at the data layer, not the guard
    - _Bug_Condition: isBugCondition(X) where X.emailVerified=null AND X.accountType='seeded' AND X.guardChecksNullAsUnverified=true_
    - _Expected_Behavior: all seeded ACTIVE users have emailVerified set; AuthGuard never redirects them to /verify-email (Property 3)_
    - _Preservation: genuinely unverified non-demo users continue to be redirected to /verify-email (Property 6)_
    - _Requirements: 2.5_

  - [x] 8.2 Fix System Admin saved-redirect path (RC-06)
    - In `frontend/src/shared/providers/auth-guard.tsx`, locate the saved-redirect block
    - Change the guard so System Admins are NEVER sent to a non-admin path via a saved redirect:
      ```tsx
      if (savedRedirect && savedRedirect !== '/login' && savedRedirect !== '/register') {
        const isAdminPath = savedRedirect.startsWith('/admin');
        // System Admins must always go to admin paths — never tenant /dashboard
        if (isSystemAdmin && !isAdminPath) {
          // Fall through to role-based default routing below
        } else if (!isAdminPath || isSystemAdmin) {
          router.replace(savedRedirect);
          return;
        }
      }
      ```
    - Verify the role-based default below correctly sends `isSystemAdmin` users to `/admin/dashboard`
    - Do NOT change how non-System Admin users follow saved redirects
    - _Bug_Condition: isBugCondition(X) where X.role='System Admin' AND X.routedTo='/dashboard' AND X.savedRedirectIsNonAdmin=true_
    - _Expected_Behavior: System Admin always routes to /admin/dashboard regardless of saved redirect (Property 4)_
    - _Preservation: System Admin with a valid saved /admin/* path still follows it; regular users' saved redirects unchanged_
    - _Requirements: 2.6_

  - [x] 8.3 Fix invited user onboarding gate (RC-07)
    - In `frontend/src/shared/providers/auth-guard.tsx`, locate the onboarding gate (Gate 2)
    - Add `onboardingCompletedAt` to the gate condition so invited users with a completed tenant are not re-routed:
      ```tsx
      const tenantName   = (user as any).tenantName;
      const onboardingAt = (user as any).onboardingCompletedAt;
      const localDone    = typeof window !== 'undefined'
        ? localStorage.getItem(ONBOARDING_COMPLETE_KEY)
        : null;

      if (!tenantName && !localDone && !onboardingAt) {
        sessionStorage.removeItem('leadcrm_redirect_after_login');
        router.replace('/onboarding');
        return;
      }
      ```
    - Verify `buildAuthUserResponse` in `backend/src/core/auth/auth.service.ts` already includes the tenant `onboardingCompletedAt` join (it does per RC-02 fix — confirm only)
    - Do NOT remove the gate for users who genuinely have not onboarded
    - _Bug_Condition: isBugCondition(X) where X.registeredVia='invitation' AND X.tenantName=null AND X.onboardingNotRequired=true_
    - _Expected_Behavior: invited users with a valid tenantId and onboarded tenant are NOT sent to /onboarding (Property 5)_
    - _Preservation: new tenant users (no tenantName, no localDone, no onboardingAt) continue to be routed to /onboarding_
    - _Requirements: 2.7_

  - [x] 8.4 Improve backend-unreachable / CORS error message (RC-08, RC-09)
    - In `frontend/src/store/AuthContext.tsx`, locate the `restoreSession` catch block
    - Improve the error message to help users and developers distinguish network/CORS failures from auth failures:
      ```typescript
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const isCorsOrNetwork = err instanceof TypeError || msg.toLowerCase().includes('fetch');
      setAuthError(
        isCorsOrNetwork
          ? 'Unable to connect to the server. Check your network connection or contact support.'
          : msg || 'Unable to verify your session',
      );
      ```
    - Ensure `isNoSessionError` (the 401 classifier) is NOT changed — 401s must remain classified as "no session" (no error shown)
    - The `AuthGuard` error UI and `retryAuthInit` are already wired — no change needed there
    - _Bug_Condition: isBugCondition(X) where X.backendReachable=false AND X.authInitErrorSurfaced=false_
    - _Expected_Behavior: TypeError/network failures produce a user-readable connectivity message; AuthGuard shows error+retry UI (Property 2)_
    - _Preservation: 401 no-session path (logged out) still results in authError=null and redirect to /login_
    - _Requirements: 2.8, 2.9_

  - [x] 8.5 Remove race-condition manual navigation from login page (RC-10)
    - Locate the login page component (search for the form submission handler that calls `login()`)
    - If the handler contains `router.push('/dashboard')` or `router.replace('/dashboard')` after `login()` succeeds, remove it — AuthGuard must own all post-login routing
    - The correct pattern after a successful `login()`:
      ```tsx
      const success = await login(email, password);
      if (!success) {
        setError('Invalid email or password');
      }
      // AuthGuard will redirect once user state is committed — do NOT navigate manually here
      ```
    - Verify the login page also does NOT have a `useEffect` that pushes to a protected route when `user` is set (that would create the loop RC-12 describes)
    - _Bug_Condition: isBugCondition(X) where X.enteredVia='login' AND X.authContextUserUpdated=false AND X.guardEvaluatesImmediately=true_
    - _Expected_Behavior: login page does not navigate; AuthGuard handles routing after user state is committed (Property 1)_
    - _Preservation: failed login stays on /login with error message unchanged_
    - _Requirements: 2.4_

  - [x] 8.6 Add DataContext Batch 1 failure toast notification (RC-03, UX)
    - In `frontend/src/store/DataContext.tsx`, locate the Batch 1 try/catch block
    - Add a `toast.error()` call for genuine transport failures (non-403) so users know data loading failed:
      ```typescript
      } catch (err) {
        console.error('[DataContext] Failed to load CRM data from API:', err);
        if (err instanceof Error && !err.message.includes('403')) {
          toast.error('Failed to load data. Please refresh the page.');
        }
      }
      ```
    - Import `toast` from `'sonner'` (already used in the project) — do NOT add a new toast library
    - Do NOT change the data-loading logic, batch structure, or mock-mode path
    - This is a UX improvement, not a blank-screen fix — the dashboard renders correctly with empty arrays; the toast prevents silent data gaps
    - _Bug_Condition: isBugCondition(X) where X.dataContextBatch1Failed=true AND X.dashboardHasNoFallback=true_
    - _Expected_Behavior: Batch 1 transport failures show a toast error; dashboard still renders with empty arrays (not blocked)_
    - _Preservation: 403 plan-gate responses do NOT show a generic error toast; mock-mode data loading unchanged_
    - _Requirements: 2.3_

  - [x] 8.7 Confirm RC-11 (login() me() fallback) and RC-12 (redirect loop) are already resolved
    - **RC-11**: Read `frontend/src/store/AuthContext.tsx` — confirm `login()` has the try/catch around `authApi.me()` that falls back to the login payload and still returns `true`; confirm the function never reaches a `return false` path when the backend login call succeeded
    - **RC-12**: Read `frontend/src/shared/providers/auth-guard.tsx` — confirm there is no `router.push(...)` inside the guard that can create a loop with the login page; read the login page component and confirm it does not push to a protected route on component mount when `user` is null
    - Write inline comments in the respective files confirming the resolved state for RC-11 and RC-12 if no such comments already exist — this documents the intentional behavior for future maintainers
    - No behavior changes — this is a verification and documentation task only
    - _Requirements: 2.4_

  - [x] 8.8 Verify Phase 2 bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Routing Defects and UX Gaps Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 6 — do NOT write new tests
    - Run all Phase 2 bug condition exploration tests from task 6
    - **EXPECTED OUTCOME**:
      - RC-05 tests PASS (seeded accounts now have `emailVerified` set; guard no longer redirects to `/verify-email`)
      - RC-06 test PASSES (System Admin is never sent to `/dashboard` via saved redirect)
      - RC-07 test PASSES (`AuthGuard` does not redirect invited user to `/onboarding` when `tenantName` is set)
      - RC-08/09 test PASSES (`authError` message now mentions network/connectivity)
      - RC-10 test PASSES (login page no longer manually navigates after `login()` success)
      - RC-11 and RC-12 tests continue to PASS (already resolved)
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 8.9 Verify Phase 2 preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy Auth Scenarios Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 7 — do NOT write new tests
    - Run all Phase 2 preservation tests from task 7
    - **EXPECTED OUTCOME**: ALL preservation tests PASS — genuinely unverified users still gate, valid admin saved redirects still work, new-tenant onboarding still fires, 401 responses still produce no-error redirect to login
    - Confirm no regressions introduced by Phase 2 changes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 9. Extended integration tests for Phase 2 scenarios
  - **RC-05 integration**: `admin@democorp.com` (seeded, was `emailVerified = null`) logs in → lands on `/dashboard` without hitting `/verify-email` (Property 3)
  - **RC-06 integration**: System Admin logs in after previously having a `/dashboard` saved redirect → lands on `/admin/dashboard` (Property 4)
  - **RC-07 integration**: Invited user (tenant with name, `onboardingCompletedAt = null` for user) logs in → lands on `/dashboard` directly without hitting `/onboarding` (Property 5)
  - **RC-08 integration**: With backend server stopped, navigate to the app → see connectivity error with retry button (not a blank screen), click retry when server starts → successfully restores session (Property 2)
  - **RC-10 integration**: Log in via the credentials form → confirm no flash of `/login` after success; only one route transition occurs (dashboard or admin dashboard)
  - **RC-03 UX**: Kill the `/crm/leads` endpoint mid-load → confirm a toast notification appears; dashboard is still rendered with empty stat cards (not blocked indefinitely)
  - All Phase 1 integration tests from task 4 must still pass (regression gate)
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 10. Final checkpoint — all phases complete
  - Ensure all exploration, preservation, unit, and integration tests across both phases pass (tasks 1–9)
  - Run `npm run lint` (turbo type-check across all 3 workspaces) — must pass with zero errors
  - Run `npm run build` (all workspaces) — must pass
  - Confirm the Prisma migration (or seed-level idempotent patch) for `emailVerified` runs cleanly on a fresh database: `npm --prefix backend run db:migrate`
  - Verify seeded users in a fresh seed have `emailVerified` set: `npm --prefix backend run db:seed`
  - Ask the user if any questions arise before marking complete
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
