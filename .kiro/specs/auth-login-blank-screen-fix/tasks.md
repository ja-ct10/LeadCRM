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
