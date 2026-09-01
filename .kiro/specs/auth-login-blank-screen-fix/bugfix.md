# Bugfix Requirements Document

## Introduction

After logging in with valid credentials (real API mode: `NEXT_PUBLIC_USE_MOCK_AUTH=false`,
`NEXT_PUBLIC_USE_MOCK_DATA=false`), the user is redirected to `/dashboard` but sees a blank
white screen instead of the CRM. Direct navigation to `/dashboard`, page refresh, and logout
can also produce a blank screen or unexpected redirect back to onboarding/verification even
for a fully verified and onboarded user.

Code inspection confirmed the primary root cause is a **response contract mismatch** between
the login endpoint and the auth gate:

- `POST /api/v1/auth/login` (`backend/src/core/auth/auth.controller.ts` → `login`) returns a
  user object containing only `id, email, role, firstName, lastName, tenantId`. It does **not**
  include `emailVerified` or `onboardingCompletedAt`.
- `GET /api/v1/auth/me` (same file → `me`) **does** include `emailVerified`,
  `onboardingCompletedAt`, `onboardingStep`, and `tenantName`.
- `AuthContext.login()` (`frontend/src/store/AuthContext.tsx`) stores the login response
  directly via `setUser(apiUser)`.
- `AuthGuard` (`frontend/src/shared/providers/auth-guard.tsx`) gates on `user.emailVerified`
  and `user.onboardingCompletedAt`. Because the login payload omits these fields, they read as
  `undefined` (falsy), so a verified, onboarded user is wrongly redirected to `/verify-email`
  or `/onboarding` immediately after login. On refresh the user is hydrated from `/auth/me`
  (which has the fields), so behavior differs between fresh login and refresh.

A secondary root cause is that the auth resolution has **no visible loading or error state**.
`AuthGuard` returns `null` while `isLoading` is true and when `user === null`; the root page,
`/onboarding`, and `/company-setup` routes also `return null`. When auth resolution stalls, a
redirect misfires, or `/auth/me` fails, the user is left staring at a silent blank white screen
with no spinner, message, or recovery path.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a verified and onboarded user logs in with valid credentials via `POST /auth/login` THEN the system stores a user object missing `emailVerified` and `onboardingCompletedAt`, causing AuthGuard to redirect to `/verify-email` or `/onboarding` instead of rendering the dashboard
1.2 WHEN AuthGuard is in the `isLoading` state or resolves `user === null` THEN the system renders `null` (a blank white screen) with no loading indicator or feedback
1.3 WHEN auth initialization (`/auth/me`) stalls or fails after navigation to `/dashboard` THEN the system shows a persistent blank white screen with no error state or retry path
1.4 WHEN the login response contract differs from the `/auth/me` contract THEN the system produces different post-login and post-refresh routing outcomes for the same user
1.5 WHEN the onboarding/company-setup redirect logic evaluates missing gate fields THEN the system can bounce the user between `/dashboard`, `/onboarding`, and `/company-setup` without settling on a rendered page

### Expected Behavior (Correct)

2.1 WHEN a verified and onboarded user logs in with valid credentials THEN the system SHALL resolve complete auth state (including `emailVerified` and `onboardingCompletedAt`) and render `/dashboard` without a blank screen
2.2 WHEN AuthGuard is resolving auth state THEN the system SHALL display a visible loading state (never a silent blank screen)
2.3 WHEN auth initialization fails or stalls THEN the system SHALL resolve to an explicit error state or redirect to `/login`, never a silent blank white screen
2.4 WHEN a user logs in and when the same user refreshes the page THEN the system SHALL produce the same routing outcome by using a consistent auth-state contract for both paths
2.5 WHEN the onboarding gate is evaluated for a verified, onboarded user THEN the system SHALL route to `/dashboard` as a single, non-looping flow with no duplicate onboarding/company-setup screens

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits invalid credentials THEN the system SHALL CONTINUE TO show an error toast and remain on the login page with no redirect
3.2 WHEN an unauthenticated user directly navigates to `/dashboard` THEN the system SHALL CONTINUE TO redirect to `/login` (and preserve the intended path for post-login redirect)
3.3 WHEN a genuinely unverified user logs in THEN the system SHALL CONTINUE TO route to `/verify-email`
3.4 WHEN a genuinely not-yet-onboarded user logs in THEN the system SHALL CONTINUE TO route to `/onboarding`
3.5 WHEN a System Admin logs in THEN the system SHALL CONTINUE TO route to `/admin/dashboard`
3.6 WHEN a user logs out THEN the system SHALL CONTINUE TO clear auth state, revoke the session/cookie, and return to `/login`
3.7 WHEN a user signs in with Google OAuth THEN the system SHALL CONTINUE TO complete the NextAuth flow and hydrate auth state via `/auth/me`
3.8 WHEN an authenticated, verified, onboarded user is on the dashboard THEN the system SHALL CONTINUE TO NOT redirect them back to `/login` or `/onboarding`

## Bug Condition and Properties

**Definitions**
- **F**: The original (unfixed) auth/login + AuthGuard flow.
- **F'**: The fixed flow.
- **X**: A login/session-resolution scenario — a user with a set of server-side attributes
  (`emailVerified`, `onboardingCompletedAt`, `role`, `status`) authenticating via credentials
  or being restored from an existing session, then landing on `/dashboard`.

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AuthScenario
  OUTPUT: boolean

  // The bug is triggered when a user who SHOULD reach the dashboard
  // authenticates via the login path (whose response omits gate fields),
  // OR when auth resolution has no visible loading/error state.
  RETURN
    (X.enteredVia = 'login'
      AND X.emailVerified <> null
      AND X.onboardingCompletedAt <> null
      AND X.role <> 'System Admin')
    OR (X.authPhase = 'resolving' AND X.rendersNull = true)
    OR (X.authInitFailed = true AND X.rendersNull = true)
END FUNCTION
```

### Property — Fix Checking

```pascal
// Property 1: A verified, onboarded credentials-login user renders the dashboard
FOR ALL X WHERE isBugCondition(X) AND X.enteredVia = 'login'
                AND X.emailVerified <> null AND X.onboardingCompletedAt <> null DO
  result <- F'(X)
  ASSERT result.route = '/dashboard' AND result.rendered = true AND no_blank_screen(result)
END FOR

// Property 2: Auth resolution never shows a silent blank screen
FOR ALL X WHERE isBugCondition(X) AND (X.authPhase = 'resolving' OR X.authInitFailed = true) DO
  result <- F'(X)
  ASSERT result.shows_loading_state = true OR result.shows_error_state = true
         OR result.route = '/login'
  ASSERT no_silent_blank_screen(result)
END FOR

// Property 3: Login and refresh produce identical routing for the same user
FOR ALL X WHERE isBugCondition(X) DO
  ASSERT route_after_login(F'(X)) = route_after_refresh(F'(X))
END FOR
```

### Property — Preservation Checking

```pascal
// For all non-buggy inputs, the fixed flow behaves identically to the original.
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR

// Explicit preserved cases:
//   invalid credentials      -> error, stay on /login
//   logged-out /dashboard    -> redirect /login
//   truly unverified user    -> /verify-email
//   truly not-onboarded user -> /onboarding
//   System Admin             -> /admin/dashboard
//   logout                   -> clear state + /login
```

## Scope Constraints

- Focus ONLY on authentication, login, the post-login redirect, onboarding/company-setup
  duplication, and auth loading/error states.
- Do NOT redesign the application or add major new features.
- Do NOT replace the dual-path (credentials + Google OAuth) authentication architecture.
- Preserve current LeadCRM routes, UI design, tenant isolation, RBAC, and existing CRM modules.
- Do NOT modify unrelated CRM modules.
