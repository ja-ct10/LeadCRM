# Auth Login Blank Screen Fix — Bugfix Design

## Overview

After a credentials login in real-API mode, a fully verified and onboarded user lands on a
blank white screen (or is wrongly bounced to `/verify-email` or `/onboarding`) instead of the
dashboard. Code inspection confirms two independent defects that combine to produce the symptom:

1. **Response contract mismatch (PRIMARY).** `POST /auth/login` returns a user object with only
   `id, email, role, firstName, lastName, tenantId`. `GET /auth/me` returns those plus
   `emailVerified`, `onboardingCompletedAt`, `onboardingStep`, and `tenantName`.
   `AuthContext.login()` stores the thin login payload verbatim via `setUser(apiUser)`, and
   `AuthGuard` gates on `user.emailVerified` and `user.onboardingCompletedAt`. Because those
   fields are absent from the login payload they read as `undefined` (falsy), so a verified,
   onboarded user is redirected as if unverified/un-onboarded right after login. On refresh the
   user is hydrated from `/auth/me` (which has the fields), so behavior differs between fresh
   login and refresh.

2. **Silent blank screen (SECONDARY).** `AuthGuard` returns `null` while `isLoading` and when
   `user === null`; the root page (`/`), `/onboarding`, and `/company-setup` route shells also
   `return null` during auth resolution. When resolution stalls, a redirect misfires, or
   `/auth/me` fails, the user sees a silent white screen with no spinner, message, or recovery
   path. `AuthContext` also swallows `/auth/me` failures by silently setting `user = null`.

The fix approach is deliberately minimal and targeted:

- **Align the login response contract with the `/auth/me` contract** so both paths hydrate the
  same complete gate fields. This makes post-login and post-refresh routing identical.
- **Replace every silent `null` render during auth resolution with a visible loading state**,
  and give `AuthContext` an explicit auth-init error state so a failed `/auth/me` never leaves a
  blank screen.

The dual-path (credentials + Google OAuth) architecture, RBAC, tenant isolation, System Admin
routing, and logout behavior are all preserved unchanged.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — either (a) a verified, onboarded
  non-System-Admin user enters via the credentials `login` path whose response omits the gate
  fields, or (b) auth resolution is in a resolving/failed phase while the UI renders `null`.
- **Property (P)**: The desired behavior — a verified, onboarded login user renders `/dashboard`;
  auth resolution always shows a visible loading or error state (never a silent blank screen);
  and login and refresh produce identical routing for the same user.
- **Preservation**: Existing behavior that must remain unchanged — invalid-credential handling,
  logged-out redirect to `/login`, genuine unverified → `/verify-email`, genuine not-onboarded →
  `/onboarding`, System Admin → `/admin/dashboard`, logout, and the Google OAuth flow.
- **Gate fields**: `emailVerified` and `onboardingCompletedAt` (plus `onboardingStep`,
  `tenantName`) — the server-backed fields `AuthGuard` reads to decide routing.
- **loginUser**: The service function in `backend/src/core/auth/auth.service.ts` that
  authenticates credentials and builds the returned user object.
- **login (controller)**: The handler in `backend/src/core/auth/auth.controller.ts` that wraps
  `loginUser` and sets the cookie.
- **me (controller)**: The handler in `backend/src/core/auth/auth.controller.ts` that returns the
  complete user + flattened tenant fields — the canonical contract.
- **restoreSession / login (AuthContext)**: The two hydration paths in
  `frontend/src/store/AuthContext.tsx` that call `setUser`.
- **AuthGuard**: The gate in `frontend/src/shared/providers/auth-guard.tsx` that reads the gate
  fields and redirects; currently `return null` during resolution.

## Bug Details

### Bug Condition

The bug manifests when a verified, onboarded, non-System-Admin user authenticates through the
credentials `login` path — because that path's response omits `emailVerified` and
`onboardingCompletedAt`, so `AuthGuard` reads them as falsy and misroutes. It also manifests
whenever auth resolution is in a `resolving` or `failed` phase while the guard or a route shell
renders `null`, producing a silent blank screen.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type AuthScenario
  OUTPUT: boolean

  RETURN
    (X.enteredVia = 'login'
      AND X.emailVerified <> null
      AND X.onboardingCompletedAt <> null
      AND X.role <> 'System Admin')
    OR (X.authPhase = 'resolving' AND X.rendersNull = true)
    OR (X.authInitFailed = true AND X.rendersNull = true)
END FUNCTION
```

### Examples

- **Verified + onboarded login (primary):** Alice (verified, onboarding complete, role
  `Client Admin`) logs in via `POST /auth/login`. Expected: renders `/dashboard`. Actual: the
  login payload lacks `emailVerified`/`onboardingCompletedAt`, so `AuthGuard` redirects to
  `/verify-email` (or `/onboarding`), then the route shell renders `null` → blank white screen.
- **Login vs refresh divergence:** The same Alice, after refreshing, is hydrated from `/auth/me`
  (which includes the gate fields) and correctly reaches `/dashboard`. Different outcome for the
  same user depending on entry path.
- **Auth-init failure:** `/auth/me` fails (network/backend hiccup) during `restoreSession`;
  `AuthContext` silently sets `user = null` and `AuthGuard` returns `null` → persistent blank
  screen with no error or retry.
- **Genuine unverified user (edge — NOT a bug):** Bob (never verified) logs in. Correct behavior
  is `/verify-email`; this must be preserved and is NOT part of the bug condition.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Invalid credentials continue to show an error toast and keep the user on `/login` (no redirect).
- Unauthenticated navigation to `/dashboard` continues to redirect to `/login`, preserving the
  intended path in `sessionStorage` for post-login redirect.
- A genuinely unverified user continues to route to `/verify-email`.
- A genuinely not-yet-onboarded user continues to route to `/onboarding`.
- A System Admin continues to route to `/admin/dashboard` and bypasses onboarding/verification gates.
- Logout continues to clear auth state, revoke the session/cookie, clear onboarding flags, and
  return to `/login`.
- Google OAuth continues to complete the NextAuth flow and hydrate via `/auth/me`.
- An authenticated, verified, onboarded user on the dashboard is not redirected back to `/login`
  or `/onboarding`.

**Scope:**
All inputs that do NOT satisfy the bug condition must be completely unaffected. This includes:
- Mock-mode auth (`NEXT_PUBLIC_USE_MOCK_AUTH !== 'false'`) — unchanged localStorage flow.
- All CRM modules, RBAC checks, and tenant-isolation behavior.
- The OTP/verify-email and password-reset flows.

**Note:** The actual expected correct behavior for buggy inputs is defined in the
Correctness Properties section (Property 1). This section focuses on what must NOT change.

## Hypothesized Root Cause

Based on code inspection, the confirmed causes are:

1. **Login response omits gate fields (confirmed, PRIMARY).**
   - `loginUser` in `auth.service.ts` returns `{ id, email, role, firstName, lastName, tenantId }`.
   - `me` in `auth.controller.ts` returns the same plus `emailVerified`, `onboardingCompletedAt`,
     `onboardingStep`, `tenantName`, `industry`, `companySize`.
   - `AuthGuard` gates on `user.emailVerified` and `user.onboardingCompletedAt`; both are
     `undefined` after a fresh login, so the guard misroutes.

2. **`AuthContext.login()` stores the thin payload verbatim (confirmed).**
   - `login()` does `setUser(apiUser)` from the login response, never re-hydrating from `/auth/me`,
     so the missing fields persist in client state until a refresh.

3. **Silent `null` renders during auth resolution (confirmed, SECONDARY).**
   - `AuthGuard`: `if (isLoading) return null; if (user === null) return null;`
   - Root page, `/onboarding`, `/company-setup`: `if (isLoading || !user) return null;`
   - No spinner, message, or recovery path is rendered while resolving or after a redirect misfire.

4. **`AuthContext` swallows auth-init failure (confirmed).**
   - `restoreSession`'s `catch` sets `user = null` with no distinction between "no session" and
     "`/auth/me` failed", so a transient backend error looks identical to a logged-out state and
     produces a blank screen with no error surface.

## Correctness Properties

Property 1: Bug Condition — Verified, Onboarded Login User Reaches the Dashboard

_For any_ scenario where the bug condition holds and the user entered via the credentials `login`
path with `emailVerified <> null` and `onboardingCompletedAt <> null` (and is not a System Admin),
the fixed flow SHALL resolve complete auth state (including `emailVerified` and
`onboardingCompletedAt`) and render `/dashboard` without a blank screen — identical to the outcome
produced by hydrating from `/auth/me`.

**Validates: Requirements 2.1, 2.4**

Property 2: Bug Condition — Auth Resolution Never Shows a Silent Blank Screen

_For any_ scenario where the bug condition holds because auth is resolving or auth initialization
failed, the fixed flow SHALL show a visible loading state or an explicit error state (or redirect
to `/login`), and SHALL NOT render a silent blank white screen.

**Validates: Requirements 2.2, 2.3**

Property 3: Bug Condition — Login and Refresh Produce Identical Routing

_For any_ scenario where the bug condition holds, the route the fixed flow settles on after a
fresh login SHALL equal the route it settles on after a page refresh for the same user, because
both paths now hydrate from the same complete auth-state contract.

**Validates: Requirements 2.4, 2.5**

Property 4: Preservation — Non-Buggy Auth Scenarios Are Unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false), the fixed
flow SHALL produce the same result as the original flow, preserving invalid-credential handling,
logged-out redirect to `/login`, genuine unverified → `/verify-email`, genuine not-onboarded →
`/onboarding`, System Admin → `/admin/dashboard`, logout behavior, and the Google OAuth flow.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Design Decision: How to align the contract

Two options were considered for eliminating the contract mismatch (Property 1 / 3):

- **Option A — Expand the backend login response** so `loginUser` / `login` return the same
  flattened fields as `me` (`emailVerified`, `onboardingCompletedAt`, `onboardingStep`,
  `tenantName`).
- **Option B — Frontend re-hydration:** after a successful `login()`, call `authApi.me()` and
  `setUser` from that complete payload instead of the thin login payload.

**Chosen: Option A as the primary fix, with Option B as defense-in-depth.**

Rationale:
- Option A fixes the mismatch at its source — the contract itself — so any current or future
  consumer of the login response (not just `AuthContext`) gets consistent data. It makes the
  login and `/auth/me` contracts converge, which is exactly what Property 3 requires.
- Option A is the least invasive at the layer that owns the contract: the change is additive
  (extra fields), touches no auth logic, no cookie/session behavior, and no query beyond widening
  the existing user lookup to include the tenant relation already selected by `me`.
- Option B alone would leave the backend contract inconsistent and add a second network round-trip
  on every login. However, adding Option B on top is cheap and guarantees the client converges on
  the canonical `/auth/me` shape even if a future caller bypasses the widened login response — so
  both are included, with `login()` re-hydrating via `/auth/me` after storing the login payload.

To avoid duplicating the flatten logic between `login` and `me`, the flatten mapping is extracted
into a small shared helper.

### Changes Required

**File**: `backend/src/core/auth/auth.service.ts`

**Function**: `loginUser`

1. **Widen the user lookup** to include the tenant relation fields that `me` already selects
   (`tenant.name`, `tenant.onboardingStep`, `tenant.onboardingCompletedAt`, `tenant.industry`,
   `tenant.companySize`) and the user's `emailVerified` field.
2. **Return the aligned user shape** — add `emailVerified`, `onboardingStep`,
   `onboardingCompletedAt`, and `tenantName` to the returned `user` object so it matches the
   `/auth/me` contract. No change to token issuance, session creation, or the verification/status
   guards.

**File**: `backend/src/core/auth/auth.controller.ts`

3. **Extract a shared flatten helper** (e.g. `buildAuthUserResponse(user, tenant)`) used by both
   `me` and the login response construction, so the login and `/auth/me` payloads are guaranteed
   identical in shape. `login` passes the widened `loginUser` result through this helper (or
   `loginUser` returns the already-flattened shape and `login` forwards it unchanged).

**File**: `frontend/src/store/AuthContext.tsx`

4. **Re-hydrate after login (defense-in-depth):** in `login()`, after a successful
   `authApi.login(...)`, call `authApi.me()` and `setUser` from that canonical payload; fall back
   to the (now complete) login payload if the `me` call fails. This guarantees the stored user
   always carries the gate fields.
5. **Add an explicit auth-init error state:** introduce `authError` state. In `restoreSession`,
   distinguish "no session" (401 → `user = null`, no error) from a genuine `/auth/me` transport
   failure (set `authError`). Expose `authError` and a `retryAuthInit` action through the context
   so the UI can render a recovery path. Business logic and mock-mode behavior are unchanged.

**File**: `frontend/src/shared/providers/auth-guard.tsx`

6. **Replace silent `null` with visible states:**
   - While `isLoading`: render a full-screen loading state (reusing the existing
     `animate-spin` spinner pattern with dark-mode classes and an `aria-label`) instead of `null`.
   - When `authError` is set: render an explicit error state with a retry action (or redirect to
     `/login`) instead of `null`.
   - The `user === null` case still redirects to `/login`; during that brief redirect render the
     same loading state rather than `null` so no blank frame is shown.
   - Gate logic (verification, onboarding, System Admin, saved-redirect, role-based default) is
     unchanged.

**File**: `frontend/app/page.tsx`, `frontend/app/onboarding/page.tsx`,
`frontend/app/company-setup/page.tsx`

7. **Replace `return null` during resolution with the shared loading state.** Extract a small
   shared `AuthLoadingScreen` component (colocated under `shared/components` or
   `shared/providers`) so all four surfaces render an identical visible spinner instead of a
   blank screen. Redirect logic and navigation handlers are unchanged.

### Non-goals (explicitly out of scope)

- No redesign of the app, no new features, no replacement of the dual-path auth architecture.
- No change to JWT/session/cookie mechanics, RBAC, tenant isolation, or any CRM module.
- No change to the mock-auth localStorage flow.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate
the bug on the unfixed code, then verify the fix works and preserves existing behavior. Because the
defect spans backend contract and frontend rendering, tests are split between backend
service/controller assertions and frontend guard/context behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or
refute the root-cause analysis. If refuted, re-hypothesize.

**Test Plan**: Assert the shape of the `POST /auth/login` response against the `GET /auth/me`
response for the same verified, onboarded user, and simulate `AuthGuard` gate evaluation with the
login payload. Run on the UNFIXED code to observe the missing fields and the resulting misroute.

**Test Cases**:
1. **Login contract shape**: For a verified, onboarded user, assert the login response `user`
   contains `emailVerified` and `onboardingCompletedAt` (will fail on unfixed code — fields absent).
2. **Login vs me parity**: Assert the login `user` shape equals the `/auth/me` `user` shape for the
   same user (will fail on unfixed code — shapes diverge).
3. **Guard misroute**: Feed the unfixed login payload into `AuthGuard`'s gate evaluation and assert
   it does NOT redirect a verified, onboarded user to `/verify-email` or `/onboarding` (will fail).
4. **Silent blank screen**: Assert `AuthGuard` renders a loading indicator (not `null`) while
   `isLoading` (will fail on unfixed code — returns `null`).
5. **Auth-init failure (edge)**: Simulate `/auth/me` throwing during `restoreSession` and assert an
   error/recovery state is exposed rather than a silent `user = null` blank screen (will fail).

**Expected Counterexamples**:
- Login response `user` is missing `emailVerified` and `onboardingCompletedAt`.
- `AuthGuard` returns `null` (blank) while resolving and on auth-init failure.
- Root cause confirmed: contract mismatch + silent null renders.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed flow produces the
expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := fixedFlow(X)
  ASSERT expectedBehavior(result)
  // enteredVia='login' & verified & onboarded  -> route='/dashboard' AND rendered AND NOT blank
  // authPhase='resolving' OR authInitFailed     -> shows_loading OR shows_error OR route='/login'
  //                                                 AND NOT silent_blank_screen
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed flow produces
the same result as the original flow.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT originalFlow(X) = fixedFlow(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many auth scenarios automatically across the input domain
  (`emailVerified × onboardingCompletedAt × role × status × enteredVia`).
- It catches edge combinations that hand-written unit tests miss.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on the UNFIXED code first for non-bug scenarios (invalid
credentials, logged-out redirect, genuine unverified, genuine not-onboarded, System Admin, logout,
OAuth), then write property-based and example tests capturing that behavior and re-run on the fixed
code.

**Test Cases**:
1. **Invalid credentials**: Observe error + stay on `/login` on unfixed code; assert unchanged.
2. **Logged-out `/dashboard`**: Observe redirect to `/login` with saved path; assert unchanged.
3. **Genuine unverified**: Observe route to `/verify-email`; assert unchanged.
4. **Genuine not-onboarded**: Observe route to `/onboarding`; assert unchanged.
5. **System Admin**: Observe route to `/admin/dashboard`, gates bypassed; assert unchanged.
6. **Logout**: Observe state cleared + cookie revoked + `/login`; assert unchanged.
7. **Google OAuth**: Observe NextAuth flow completes + `/auth/me` hydration; assert unchanged.

### Unit Tests

- Backend: `loginUser` returns the aligned user shape (includes gate fields) for a verified,
  onboarded user; and still throws `401`/`403` for invalid credentials, unverified, and inactive
  users (guards unchanged).
- Backend: `login` and `me` responses produce identical `user` shapes via the shared flatten helper.
- Frontend: `AuthGuard` renders a loading state while `isLoading`, an error state on `authError`,
  and redirects to `/login` when `user === null` — never `null`.
- Frontend: root/`onboarding`/`company-setup` shells render the shared loading screen instead of
  `null` during resolution.

### Property-Based Tests

- Generate random `AuthScenario` inputs and assert Property 4 (preservation): for every non-buggy
  scenario, the fixed guard decision equals the original guard decision.
- Generate verified/onboarded login scenarios and assert Property 1: settles on `/dashboard`.
- Generate resolving/failed scenarios and assert Property 2: always a visible loading or error
  state, never a silent blank screen.

### Integration Tests

- Full credentials-login flow in real-API mode: verified, onboarded user logs in → lands on
  `/dashboard` with no blank frame; then refresh → same `/dashboard` (Property 3).
- Auth-init failure flow: force `/auth/me` to fail → user sees an explicit error/recovery UI, not
  a blank screen.
- OAuth flow regression: Google sign-in completes and hydrates via `/auth/me` unchanged.
