# Bugfix Requirements Document

## Introduction

Authenticated users whose tenant workspace is already fully configured are incorrectly
redirected to the `/onboarding` wizard instead of `/dashboard` on every visit. This
breaks the industry-standard CRM behavior where onboarding is a one-time, first-login-only
experience (matching Salesforce, HubSpot, Pipedrive, Zoho). The root cause is that
`AuthGuard`'s Gate 2 requires three signals to pass — `tenantName`, `localOnboardingDone`,
and `onboardingCompletedAt` — and will fire the redirect if any server-backed signal is
falsy (e.g., `tenantName` returns `null` from `/auth/me` due to a network glitch, empty
string in DB, or the tenant relation not being loaded). Because `localOnboardingDone` is
always `null` on a fresh device/incognito session, any single failure of either server
signal is sufficient to send an already-onboarded user back to onboarding. The fix must
promote `onboardingCompletedAt` to the authoritative gate signal and ensure the `/auth/me`
response always includes the tenant relation fields.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a returning authenticated user visits any protected route AND `tenantName` is
    null or empty in the `/auth/me` response (due to network, serialization, or empty-string
    name) AND `localStorage.getItem('leadcrm_onboarding_complete')` is null (fresh
    browser/device/incognito) THEN the system redirects the user to `/onboarding` even
    though `onboardingCompletedAt` is set.

1.2 WHEN a returning authenticated user visits any protected route AND `onboardingCompletedAt`
    is null in the `/auth/me` response (not set during self-service registration) AND
    `tenantName` is present THEN the system still redirects the user to `/onboarding` if
    `localOnboardingDone` is also absent.

1.3 WHEN an already-onboarded tenant member (invited user) visits any protected route on
    a fresh browser session THEN the system incorrectly routes them to `/onboarding`
    because `localOnboardingDone` is null and `onboardingCompletedAt` may not be populated
    for their tenant.

1.4 WHEN the `/auth/me` endpoint returns the user record without eagerly loading the
    `tenant` relation THEN `tenantName` and `onboardingCompletedAt` are both null in the
    response, causing Gate 2 to fire for every authenticated user regardless of their
    actual onboarding state.

1.5 WHEN a tenant is created via the self-service `registerClientAdmin` or `registerGuest`
    path AND the tenant record has `name` set but `onboardingCompletedAt` is not
    explicitly populated THEN returning users of that tenant are sent to `/onboarding`
    on every subsequent login from a new device.

### Expected Behavior (Correct)

2.1 WHEN a returning authenticated user visits any protected route AND
    `onboardingCompletedAt` is set (non-null, server-backed timestamp from `/auth/me`)
    THEN the system SHALL route the user directly to `/dashboard` (or `/admin/dashboard`
    for System Admins) without visiting `/onboarding`.

2.2 WHEN a returning authenticated user visits any protected route AND `tenantName` is a
    non-null, non-empty string from `/auth/me` THEN the system SHALL treat the tenant
    workspace as configured and route to `/dashboard` without visiting `/onboarding`.

2.3 WHEN the `/auth/me` endpoint is called THEN the system SHALL always include the
    `tenant` relation so that `tenantName` and `onboardingCompletedAt` are never absent
    from the response for authenticated users with a valid tenant.

2.4 WHEN a tenant is created via `registerClientAdmin` or `registerGuest` and the
    company name is provided THEN the system SHALL set `onboardingCompletedAt` on the
    tenant record so that returning users of that tenant are never re-routed to `/onboarding`.

2.5 WHEN the `AuthGuard` Gate 2 evaluates onboarding status THEN the system SHALL treat
    `onboardingCompletedAt` (server timestamp) as the primary authoritative signal, and
    shall only redirect to `/onboarding` when this signal is absent AND `tenantName` is
    also absent/empty AND the `localStorage` post-completion flag is also absent.

2.6 WHEN a user completes onboarding THEN the system SHALL continue to set the
    `localStorage` flag as an immediate post-completion signal to prevent a flash
    redirect before `refreshUser` completes — this signal supplements but does not
    replace the server-backed signals.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a genuinely new user whose tenant has no name and no `onboardingCompletedAt`
    visits any protected route for the first time THEN the system SHALL CONTINUE TO
    redirect them to `/onboarding` to complete workspace setup.

3.2 WHEN an unauthenticated user visits any protected route THEN the system SHALL
    CONTINUE TO redirect them to `/login`.

3.3 WHEN a user with the `System Admin` role visits any protected route THEN the system
    SHALL CONTINUE TO bypass onboarding/verification gates and route to `/admin/dashboard`.

3.4 WHEN a user visits an exempt route (e.g. `/verify-email`, `/billing`, `/settings`,
    `/company-setup`) THEN the system SHALL CONTINUE TO allow access without triggering
    onboarding or verification redirects.

3.5 WHEN an unverified user (emailVerified is null AND status is not ACTIVE) visits a
    protected route THEN the system SHALL CONTINUE TO redirect them to `/verify-email`
    before applying Gate 2 onboarding checks.

3.6 WHEN the onboarding page itself is loaded for a tenant that has already completed
    onboarding (onboardingCompletedAt is set) THEN the `/onboarding` route guard
    SHALL CONTINUE TO redirect users to `/dashboard` instead of rendering the wizard.

3.7 WHEN a user logs out THEN the system SHALL CONTINUE TO clear `localStorage`
    onboarding flags so the next user on that browser sees the appropriate flow.
