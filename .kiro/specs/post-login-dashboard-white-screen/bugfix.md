# Bugfix Requirements Document

## Introduction

After a successful credentials login (`POST /api/v1/auth/login`), the user is redirected to
`http://localhost:3000/dashboard` and the page shows a permanently white/blank screen with no
content rendered and no visible error. The problem spans the complete post-login flow:
authentication → session/JWT validation → user/tenant/role hydration via `/auth/me` →
portal routing (`AuthGuard`) → dashboard component mount → `DataContext` initial data load →
dashboard API requests → UI render.

The bug surfaces in real-API mode (`NEXT_PUBLIC_USE_MOCK_AUTH=false`,
`NEXT_PUBLIC_USE_MOCK_DATA=false`), which is the production configuration for LeadCRM.

All four user journeys are affected:
- **Existing Client Admin** — Login → Authenticate → Load user/tenant/role → Dashboard
- **System Admin** — Login → Authenticate → System Admin portal (`/admin/dashboard`)
- **New Registered User** — Register → Login → Correct portal (onboarding if genuinely required)
- **Invited User** — Accept invitation → Authenticate → Tenant workspace with assigned role

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits valid credentials on the login page THEN the system authenticates
successfully (backend returns 200 with a `leadcrm_token` HttpOnly cookie) but the redirect
to `/dashboard` results in a completely white/blank screen.

1.2 WHEN `AuthGuard` evaluates `isLoading === true` (auth init still in flight) THEN the system
fails to display the `AuthLoadingScreen` placeholder and instead renders nothing, causing a
visible white screen.

1.3 WHEN `/auth/me` is called during session restore (on mount or after login) THEN the system
may receive a response that does not match the shape expected by `AuthContext`, leaving
`user === null` even though the session cookie is valid, which causes `AuthGuard` to
immediately redirect back to `/login` (creating an auth loop).

1.4 WHEN the `DataContext` `loadData()` function is called with a valid `user` in real-API mode
THEN a failing API call (network error, CORS rejection, missing backend endpoint, or non-200
HTTP response) causes the loading state to never update and the dashboard to remain empty.

1.5 WHEN the dashboard component mounts with an un-resolved `isLoading` state (local loading
flag never set to `false`) THEN the `DashboardSkeleton` placeholder is never replaced with
the actual dashboard content, producing a frozen loading/white screen.

1.6 WHEN `AuthGuard` evaluates the gate conditions for a logged-in user THEN the
`emailVerified` field returned by `/auth/me` is `null` for existing (seeded/demo) accounts
that were created before email verification was enforced, causing `AuthGuard` to redirect
every login attempt to `/verify-email` instead of `/dashboard`.

1.7 WHEN a System Admin user completes login THEN the system incorrectly routes to
`/dashboard` (tenant portal) instead of `/admin/dashboard`, OR the `/admin/dashboard` route
renders a white screen because the admin layout/component fails to mount.

1.8 WHEN an invited user logs in after accepting an invitation THEN the system fails to
resolve the correct tenant context, routing the user to `/onboarding` or an empty workspace.

1.9 WHEN `NEXT_PUBLIC_API_URL` is set to `http://localhost:4000/api/v1` in `.env.local` but
the backend is not running on port 4000 THEN every API call from `apiClient` fails with a
`TypeError: Failed to fetch`, causing `AuthContext` to classify the failure as a transport
error, set `authError`, and display the error recovery screen (or, if the error handling
path itself is broken, a white screen).

1.10 WHEN the backend is running but CORS is not configured to allow `http://localhost:3000`
THEN `apiClient` fetch calls are blocked by the browser CORS policy, causing all auth and
data calls to fail silently and the dashboard to white-screen.

1.11 WHEN `AuthContext` calls `authApi.login()` and then immediately calls `authApi.me()` as a
post-login re-hydration step THEN the second call fails (e.g., race condition before the
cookie is fully set, or the `/auth/me` endpoint returns an unexpected response envelope)
and the login function returns `false`, leaving the user on the login page or triggering
another redirect.

1.12 WHEN the login form redirects to `/dashboard` after `login()` returns `true` THEN
`AuthGuard` re-evaluates immediately before `AuthContext` has stored the new user state,
sees `user === null`, and redirects to `/login`, creating an infinite redirect loop.

### Expected Behavior (Correct)

2.1 WHEN a user submits valid credentials THEN the system SHALL authenticate, set the
`leadcrm_token` HttpOnly cookie, hydrate `AuthContext` with the canonical user/tenant/role
from `/auth/me`, and render the correct portal without any white screen.

2.2 WHEN `AuthGuard` evaluates `isLoading === true` THEN the system SHALL render
`AuthLoadingScreen` — a visible, non-blank loading placeholder — until authentication
state is fully resolved.

2.3 WHEN `/auth/me` returns a response matching the `AuthResponse` contract THEN the system
SHALL correctly parse `res.data.user` and store it as the authenticated user so that
`user !== null` after a valid session is confirmed.

2.4 WHEN `DataContext` `loadData()` encounters an API failure THEN the system SHALL gracefully
handle the error (log it, show a non-blocking toast if appropriate) and allow the dashboard
to render with empty or partial data rather than blocking indefinitely.

2.5 WHEN the dashboard component mounts THEN the system SHALL resolve the local `isLoading`
flag within a bounded timeout and replace the `DashboardSkeleton` with rendered dashboard
content (even if that content is empty).

2.6 WHEN `AuthGuard` evaluates the email verification gate for a seeded/demo/existing user
account whose `emailVerified` is `null` in the database THEN the system SHALL honour the
`DEV_OTP_BYPASS` / `DEMO_MODE` backend flag and mark such users as effectively verified so
they can access the dashboard without being gated at `/verify-email`.

2.7 WHEN a System Admin user logs in THEN `AuthGuard` SHALL detect `role === 'System Admin'`
and redirect to `/admin/dashboard`, which SHALL mount and render correctly.

2.8 WHEN an invited user logs in THEN the system SHALL resolve their tenant context from the
JWT (`tenantId` from `/auth/me`), route them to the correct tenant workspace, and apply
their assigned role without sending them through onboarding.

2.9 WHEN `NEXT_PUBLIC_API_URL` is unreachable THEN `AuthContext` SHALL classify the error as a
transport failure, set `authError`, and render the explicit "Unable to load your session"
recovery screen with a Retry button — never a silent white screen.

2.10 WHEN CORS blocks a request THEN `apiClient` SHALL surface the error through the existing
error-throwing path so `AuthContext` and `DataContext` can handle it gracefully, and the
developer SHALL be able to identify and fix the CORS configuration without guessing.

2.11 WHEN `authApi.login()` succeeds and the post-login `authApi.me()` call also succeeds THEN
`AuthContext` SHALL store the canonical user from `/auth/me` and return `true` from
`login()`, allowing the login page to redirect to the correct portal.

2.12 WHEN the login page redirects to the dashboard after a successful `login()` call THEN
`AuthGuard` SHALL NOT redirect back to `/login` because `AuthContext` SHALL have already
stored the authenticated user before the navigation event completes.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `NEXT_PUBLIC_USE_MOCK_AUTH=true` (mock mode) THEN the system SHALL CONTINUE TO
authenticate via localStorage mock data without requiring a backend connection.

3.2 WHEN `NEXT_PUBLIC_USE_MOCK_DATA=true` (mock data mode) THEN the system SHALL CONTINUE TO
load all CRM data from localStorage mock without making real API calls.

3.3 WHEN a user session cookie is absent or expired THEN the system SHALL CONTINUE TO
redirect to `/login` cleanly (no error screen, no white screen).

3.4 WHEN a user logs out THEN the system SHALL CONTINUE TO clear the `leadcrm_token` cookie
via `POST /auth/logout`, clear `AuthContext` state, and redirect to `/login`.

3.5 WHEN a user refreshes the browser while authenticated THEN the system SHALL CONTINUE TO
restore the session from the HttpOnly cookie via `/auth/me` and re-render the dashboard
without requiring re-login.

3.6 WHEN a non-System-Admin user accesses any `/admin/*` route THEN the system SHALL
CONTINUE TO deny access and redirect to `/dashboard`.

3.7 WHEN an authenticated user navigates between CRM modules (Leads, Deals, Accounts,
Pipeline, etc.) THEN those pages SHALL CONTINUE TO load their data without white-screening.

3.8 WHEN a user's session JWT expires THEN the system SHALL CONTINUE TO return a 401 from
the backend, `AuthContext` SHALL treat this as a "no session" error (not a transport
failure), clear user state, and redirect to `/login` without showing the error recovery screen.

3.9 WHEN the backend `DEV_OTP_BYPASS=true` or `DEMO_MODE=true` flag is set and a seeded demo
user logs in THEN the system SHALL CONTINUE TO skip the email verification gate and allow
direct dashboard access, consistent with the existing demo/seed workflow.

3.10 WHEN a Google OAuth user completes the NextAuth flow THEN the system SHALL CONTINUE TO
set the `leadcrm_token` cookie via the `/auth/oauth/google` backend callback, hydrate
`AuthContext` from `/auth/me`, and route to the correct portal.

---

## Bug Condition Derivation

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type LoginAttempt {
    authMode: 'real-api',           // NEXT_PUBLIC_USE_MOCK_AUTH=false
    validCredentials: boolean,
    backendReachable: boolean,
    corsConfigured: boolean,
    userEmailVerified: boolean | null,
    userRole: string,
    sessionCookieSet: boolean,
    authMeResponseShape: 'canonical' | 'unexpected'
  }
  OUTPUT: boolean

  // Bug fires when all of:
  RETURN X.authMode = 'real-api'
    AND X.validCredentials = true
    AND (
      // Network/CORS layer broken
      X.backendReachable = false
      OR X.corsConfigured = false
      // Auth hydration broken
      OR X.authMeResponseShape = 'unexpected'
      // Gate incorrectly blocks verified/demo users
      OR (X.userEmailVerified = null AND demoBypasInactive)
      // Loading state never resolves
      OR dashboardIsLoadingStateStuck = true
    )
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← postLoginFlow'(X)
  ASSERT result.renderedPage ≠ 'white_screen'
  ASSERT result.renderedPage ≠ 'infinite_loading'
  ASSERT result.redirectLoop = false
  ASSERT result.portal IN { '/dashboard', '/admin/dashboard' }
    ACCORDING TO X.userRole
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT postLoginFlow(X) = postLoginFlow'(X)
END FOR
```
