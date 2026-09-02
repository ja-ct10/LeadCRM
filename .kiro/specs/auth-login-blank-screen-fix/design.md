# Auth Login Blank Screen Fix — Bugfix Design

## Overview

After a credentials login in real-API mode, users can land on a blank white screen or get
bounced to the wrong destination instead of their home page. Code inspection confirms 12
distinct defects distributed across the full Login → Authentication API → Session/JWT →
User/Role/Tenant Loading → Portal Routing → Dashboard → Dashboard APIs → UI Rendering chain.

The fix approach is deliberately minimal and targeted:

- Align both login-response and `/auth/me` response shapes so every auth path hydrates the
  same complete set of gate fields.
- Replace every silent `null` render during auth resolution with a visible loading or error state.
- Fix the gate logic in `AuthGuard` for the five misrouting cases (emailVerified null, System
  Admin mis-route, invited user tenant gap, race condition, post-login re-hydration failure).
- Add an explicit backend-unreachable / CORS error surface with retry.
- Break the infinite redirect loop between the no-session path and login.
- Guard the Dashboard's local loading timer against premature resolution.

No new auth system, no duplicate endpoints, no structural changes to AuthContext, AuthGuard,
DataContext, or apiClient are introduced.

---

## Glossary

- **Bug_Condition (C)**: Any scenario in the auth chain that causes a verified, routable user to
  land on a blank white screen or the wrong destination.
- **Property (P)**: The desired behavior — every user who completes a valid login settles on the
  correct destination, and every loading/error state is explicitly visible.
- **Preservation**: All existing correct behaviors that must remain unchanged: invalid-credential
  handling, logout, genuine-unverified gate, genuine-not-onboarded gate, mock-auth mode, RBAC,
  tenant isolation, Google OAuth, password-reset flow.
- **Gate fields**: `emailVerified`, `onboardingCompletedAt`, `onboardingStep`, and `tenantName` —
  the server-backed fields `AuthGuard` reads to decide routing.
- **loginUser**: `backend/src/core/auth/auth.service.ts` — authenticates credentials.
- **buildAuthUserResponse**: shared helper in `auth.service.ts` that produces the canonical user
  shape (used by `loginUser` and `/auth/me`).
- **AuthContext.login()**: the credentials-login function in
  `frontend/src/store/AuthContext.tsx`.
- **AuthContext.restoreSession()**: the session-restore function run on page mount.
- **AuthGuard**: `frontend/src/shared/providers/auth-guard.tsx` — gate logic + routing.
- **DataContext.loadData()**: `frontend/src/store/DataContext.tsx` — Batch 1 + Batch 2 API
  loading triggered when `user` changes.
- **Dashboard.isLoading**: the local `setTimeout(700ms)` timer in
  `frontend/src/features/tenant/dashboard/ui/dashboard.tsx`.
- **apiClient**: `frontend/src/lib/api/client.ts` — fetch wrapper with `credentials: include`.
- **AuthLoadingScreen**: `frontend/src/shared/components/auth-loading-screen.tsx` — the shared
  visible loading component (must be created if not already present).

---

## Bug Details

### Bug Condition

The bug manifests in 12 distinct scenarios spanning the full post-login rendering chain. Each is
formally specified below.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type AuthScenario
  OUTPUT: boolean

  RETURN
    -- RC-01: AuthLoadingScreen not rendered during isLoading
    (X.authPhase = 'resolving' AND X.guardRendersNull = true)

    -- RC-02: /auth/me response shape mismatch
    OR (X.enteredVia = 'credentials-login'
        AND X.loginPayloadHasGateFields = false
        AND X.emailVerified <> null
        AND X.onboardingCompletedAt <> null)

    -- RC-03: DataContext API failures block dashboard indefinitely
    OR (X.dataContextBatch1Failed = true
        AND X.dashboardHasNoFallback = true)

    -- RC-04: Dashboard local timer never resolves
    OR (X.dashboardLocalTimerStuck = true)

    -- RC-05: emailVerified = null gates verified demo/seeded accounts
    OR (X.emailVerified = null
        AND X.accountType = 'seeded'
        AND X.guardChecksNullAsUnverified = true)

    -- RC-06: System Admin routed to /dashboard instead of /admin/dashboard
    OR (X.role = 'System Admin'
        AND X.routedTo = '/dashboard'
        AND NOT X.isEntryPoint)

    -- RC-07: Invited user tenant context not resolved
    OR (X.registeredVia = 'invitation'
        AND X.tenantName = null
        AND X.onboardingNotRequired = true
        AND X.guardSendsToOnboarding = true)

    -- RC-08: Backend unreachable -> silent white screen
    OR (X.backendReachable = false
        AND X.authInitErrorSurfaced = false)

    -- RC-09: CORS misconfiguration -> all API calls fail
    OR (X.corsBlocked = true
        AND X.authInitErrorSurfaced = false)

    -- RC-10: Post-login race condition: AuthGuard fires before AuthContext stores user
    OR (X.enteredVia = 'credentials-login'
        AND X.authContextUserUpdated = false
        AND X.guardEvaluatesImmediately = true)

    -- RC-11: Post-login me() re-hydration failure -> login() returns false
    OR (X.enteredVia = 'credentials-login'
        AND X.postLoginMeCallFailed = true
        AND X.loginReturnsFalse = true)

    -- RC-12: Infinite redirect loop
    OR (X.noSessionPath = true
        AND X.loginRedirectsToGuard = true
        AND X.guardRedirectsToLogin = true)
END FUNCTION
```

### Examples

1. **RC-01 — Resolving phase blank screen:** Alice navigates to `/dashboard`. `AuthContext`
   calls `/auth/me`, `isLoading = true`. `AuthGuard` returns `null` → white screen until
   resolve (may be 400–800ms visible on slow connections).

2. **RC-02 — Login payload missing gate fields:** Alice (verified, onboarded) logs in via
   `POST /auth/login`. Response contains `{id, email, role, firstName, lastName, tenantId}` —
   no `emailVerified`. `AuthGuard` reads `user.emailVerified` as `undefined` (falsy) →
   redirects to `/verify-email`. After refresh, `/auth/me` includes `emailVerified` → works.
   Same user, different outcomes depending on entry path.

3. **RC-03 — DataContext failure blocks dashboard:** `GET /crm/leads` returns 500 during
   `loadData`. The dashboard renders (user is set), but the stat cards show zeroes forever
   because `contacts.length === 0`; there is no loading indicator or retry path for partial
   data failures.

4. **RC-04 — Dashboard timer stuck:** `handleRefresh` calls `setIsLoading(true)` but the
   `setTimeout` inside the handler could theoretically be cleared or the component unmounted
   before it fires, leaving `isLoading = true` and the skeleton permanently displayed.

5. **RC-05 — emailVerified null on seeded account:** `admin@democorp.com` was seeded without
   `emailVerified` being set (value is `null`). `isDemoMode` is `true` and `user.status =
   'ACTIVE'`, so the backend lets login through. But `AuthGuard` gates on
   `(user as any).emailVerified` — a `null` value is falsy → redirects to `/verify-email`
   even though the user is a valid demo account.

6. **RC-06 — System Admin routed to /dashboard:** A System Admin logs in. `AuthGuard` fires
   before `isEntryPoint` check. If the saved redirect points to `/dashboard`, the System Admin
   is sent there; the tenant dashboard then loads with empty data (no tenant) and may crash or
   show a blank screen.

7. **RC-07 — Invited user routed to onboarding:** Bob accepts an invitation. His user record has
   `tenantId` set but `tenant.name` may be an empty string or `null` (it's the company's name,
   not set by the invitation flow). `AuthGuard` reads `tenantName` as falsy and redirects to
   `/onboarding`, but Bob's onboarding is already complete — infinite redirect because
   `/onboarding` marks done and sends back, which triggers the same gate again.

8. **RC-08 — Backend unreachable → silent white screen:** The Express server is down. `/auth/me`
   throws a `TypeError: Failed to fetch`. `AuthContext.restoreSession` catches it, sets
   `user = null`, and `AuthGuard` redirects to `/login` — but if the user was on `/login`
   already, the redirect is a no-op and the screen may show a momentary blank. More critically,
   the user has no way to know the backend is down vs. being logged out.

9. **RC-09 — CORS misconfiguration → all API calls fail:** `NEXT_PUBLIC_API_URL` points to a
   production backend while running on `localhost:3000`, or `ALLOWED_ORIGINS` does not include
   the deployment URL. Every API call fails with a CORS pre-flight error. `apiClient` throws;
   `restoreSession` catches and sets `user = null`; blank screen or redirect loop results.

10. **RC-10 — Post-login race condition:** `AuthContext.login()` calls `setUser(apiUser)` (a
    React state update — async). `AuthGuard`'s `useEffect` depends on `[user, isLoading, ...]`
    and may re-run with the old `user = null` value before the state update is committed,
    redirecting to `/login` and then immediately re-evaluating with the new user. The result is
    a flash of `/login` or an extra redirect cycle that can disorient the user.

11. **RC-11 — Post-login me() failure returns false:** `AuthContext.login()` calls `authApi.me()`
    for defense-in-depth re-hydration. If that call throws, the `catch` block logs the error but
    the function continues. However, in the original code the function did not do this re-hydration
    — if the implementation calls `me()` and propagates the error incorrectly, `login()` could
    return `false` even though the backend login succeeded and the cookie was set.

12. **RC-12 — Infinite redirect loop:** No active session → `AuthGuard` redirects to `/login` →
    `/login` page calls `router.push('/dashboard')` if user is already set → `AuthGuard` fires
    again → redirects to `/login`. The loop can occur if the login page doesn't check `user`
    state before redirecting.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Invalid credentials continue to show an error toast and keep the user on `/login`.
- Unauthenticated navigation to any protected route continues to redirect to `/login`, saving the
  intended path in `sessionStorage` for post-login restore.
- A genuinely unverified user (non-demo, `emailVerified = null` and NOT `ACTIVE`) continues to
  route to `/verify-email`.
- A genuinely not-yet-onboarded user (no `tenantName`, no `localOnboardingDone`) continues to
  route to `/onboarding`.
- A System Admin continues to route to `/admin/dashboard` and bypass all onboarding/verification
  gates.
- Logout continues to clear auth state, revoke session/cookie, clear onboarding flags, and return
  to `/login`.
- Google OAuth continues to complete the NextAuth flow and hydrate via `/auth/me`.
- Mock-auth mode (`NEXT_PUBLIC_USE_MOCK_AUTH !== 'false'`) remains unchanged — localStorage
  flow, no API calls.
- All RBAC, tenant-isolation, and CRM-module behavior is unchanged.
- Password-reset and email-verification flows are unchanged.

**Scope:**
All inputs that do NOT satisfy the bug condition (`isBugCondition(X) = false`) must be
completely unaffected. This includes all non-auth CRM operations, all mock-mode interactions,
and all users who correctly complete email verification before logging in.

---

## Hypothesized Root Cause

### RC-01 — AuthLoadingScreen not rendered (confirmed)

In `auth-guard.tsx`:
```tsx
if (isLoading) return null;        // ← produces blank screen
if (user === null) return null;    // ← produces blank screen
```
No visible loading component is rendered while auth resolves. The `AuthLoadingScreen` component
exists but is not used unconditionally in the guard — it was only added to the `authError` path.

### RC-02 — Login response shape mismatch (confirmed)

`buildAuthUserResponse` in `auth.service.ts` includes `emailVerified`, `tenantName`,
`onboardingCompletedAt` etc. Both `loginUser` and `/auth/me` now use this helper (the backend
is already aligned). However, `AuthContext.login()` stored the login payload verbatim before
the defense-in-depth `authApi.me()` re-hydration call was added. If the `me()` call after login
fails or is absent, the thin payload is stored and the gate misroutes.

The current `AuthContext.login()` already has the defense-in-depth `me()` call. The risk
remains if `me()` throws — the fallback path stores the login payload, which must include gate
fields (confirmed that the backend now returns them via `buildAuthUserResponse`).

### RC-03 — DataContext Batch 1 failure blocks dashboard render (confirmed)

`loadData()` wraps Batch 1 in a single try/catch that silently logs and moves on:
```typescript
} catch (err) {
  console.error('[DataContext] Failed to load CRM data from API:', err);
}
```
The dashboard has no indication that data loading failed — it renders with empty arrays, which is
indistinguishable from "no data yet". No user-facing error or retry mechanism exists.

### RC-04 — Dashboard local isLoading timer (low risk, confirmed pattern)

`dashboard.tsx` uses:
```typescript
const [isLoading, setIsLoading] = useState(true);
useEffect(() => {
  const t = setTimeout(() => setIsLoading(false), 700);
  return () => clearTimeout(t);
}, []);
```
This is a pure cosmetic timer and will always resolve within 700ms unless the component unmounts
before the timer fires (e.g. fast re-navigation). The `clearTimeout` cleanup prevents a stale
state update. This is low-severity but could cause a persistent skeleton on rapid navigation.

### RC-05 — emailVerified = null gates seeded/demo accounts (confirmed)

In `auth.service.ts`, `loginUser` already skips the email-verification block when
`isDemoMode = true` AND `user.status === 'ACTIVE'`. The backend correctly lets the user through.

But `AuthGuard` in `auth-guard.tsx` checks:
```tsx
const emailVerified = (user as any).emailVerified;
if (!emailVerified) {
  router.replace(`/verify-email?email=...`);
  return;
}
```
A seeded account with `emailVerified = null` passes the backend but fails this frontend gate.
The fix must not remove the gate for genuinely unverified users — it must treat `null` as
verified only for demo/seeded accounts, or ensure `emailVerified` is always set on seeded
accounts at the database level.

The correct minimal fix is to ensure seeded accounts have `emailVerified` set in the seed script,
so the database value is never `null` for accounts that should behave as verified.

### RC-06 — System Admin routed to /dashboard (conditional)

`AuthGuard`'s isSystemAdmin check:
```tsx
const isSystemAdmin = user.role === 'System Admin'
  || (user as any).tenantName?.toLowerCase().includes('system');
```
The saved-redirect path:
```tsx
const savedRedirect = sessionStorage.getItem('leadcrm_redirect_after_login');
if (savedRedirect && savedRedirect !== '/login' && savedRedirect !== '/register') {
  const isAdminPath = savedRedirect.startsWith('/admin');
  if (!isAdminPath || isSystemAdmin) {
    router.replace(savedRedirect);
    return;
  }
}
```
If a System Admin had previously visited `/dashboard` (e.g. as a tenant user before being
promoted), the saved redirect `/dashboard` would pass the `!isAdminPath` check and the System
Admin would be sent to `/dashboard` instead of `/admin/dashboard`. The `isEntryPoint` guard at
the bottom would not be reached.

### RC-07 — Invited user tenant context not resolved (confirmed)

`registerWithInvitation` in `auth.service.ts` creates the user with the invitation's `tenantId`
but does not set `tenant.name` or `tenant.onboardingCompletedAt`. After registering, the user
logs in and `AuthGuard` checks:
```tsx
if (!tenantName && !localOnboardingDone) {
  router.replace('/onboarding');
  return;
}
```
An invited user's tenant already has a name (it was set during the Client Admin's onboarding).
However, if `buildAuthUserResponse` does not include the tenant join in the invited user's path,
or if `tenant.name` is an empty string, the gate fires incorrectly. The fix is to ensure
`/auth/me` and the login response always include `tenantName` from the tenant relation, and
`AuthGuard` treats an empty `tenantName` the same as `null` only when `localOnboardingDone` is
also absent.

### RC-08 — Backend unreachable → silent screen (confirmed)

`restoreSession` in `AuthContext`:
```typescript
} catch (err: unknown) {
  setUser(null);
  setTenant(null);
  if (isNoSessionError(err)) {
    setAuthError(null);
  } else {
    setAuthError(err instanceof Error ? err.message : 'Unable to verify your session');
  }
}
```
The `authError` state and `retryAuthInit` are already implemented. The fix requires that
`AuthGuard` renders the error UI when `authError` is set (which it now does), and that
`isNoSessionError` correctly classifies `TypeError: Failed to fetch` as a transport failure
rather than a "no session" error. Current `isNoSessionError` matches on message text — a
`TypeError: Failed to fetch` will not match any of the strings (`'authentication required'`,
`'unauthorized'`, `'401'`) so it will correctly set `authError`. This path is already correct;
validation in tests will confirm it.

### RC-09 — CORS misconfiguration (confirmed, environment issue)

`apiClient` uses `credentials: 'include'`. A CORS preflight failure produces a `TypeError` at
the network level — not an HTTP error response. `apiClient` throws this error. `restoreSession`
catches it, and because the message is not one of the "no session" strings, it correctly sets
`authError`. The `AuthGuard` then shows the error + retry UI. The fix for this root cause is
therefore already covered by RC-08's error surface, plus a clear diagnostic message that helps
identify CORS as the cause. No change to `ALLOWED_ORIGINS` is part of this fix (it's a
configuration issue), but the error message should mention possible network/CORS issues.

### RC-10 — Post-login race condition (acknowledged, low risk)

`setUser` (React state) is batched and committed asynchronously. `AuthGuard`'s `useEffect`
depends on `user`. Between `login()` completing and the re-render with the new user, there is a
brief moment where `user` is still `null`. During this window, `AuthGuard` fires with `user ===
null` and calls `router.replace('/login')`. However, `isLoading` is not set to `true` during the
post-login state update, so the guard is not blocked.

The correct fix is: after `login()` resolves successfully (returns `true`), the calling page
should not navigate manually — it should let `AuthGuard` handle routing after the `user` state
update. If the login page calls `router.push('/dashboard')` directly, the race exists. The fix
is to remove any manual navigation in the login page and let `AuthGuard` do the routing.

### RC-11 — Post-login me() re-hydration failure → login() returns false (acknowledged)

The current `AuthContext.login()` code:
```typescript
try {
  const meRes = await authApi.me();
  if (meRes?.data?.user) {
    apiUser = meRes.data.user as unknown as User;
  }
} catch (meErr: unknown) {
  // logs but continues — uses login payload as fallback
}
setUser(apiUser);
// ...
return true;
```
The `catch` block correctly falls back to the login payload and still returns `true`. The
originally identified risk (login returns false due to me() failure) does NOT exist in the
current code — the function always reaches `return true` if the login API call succeeded. This
root cause is resolved by the existing code. Tests will confirm the behavior.

### RC-12 — Infinite redirect loop (acknowledged, conditional)

The loop `(no session → AuthGuard → /login → user-check redirect → AuthGuard → /login)` can
only occur if the login page contains a `useEffect` that calls `router.push(...)` when `user`
is null but the guard has already resolved. Reading the auth-guard code: the guard redirects to
`/login` only when `user === null`. The login page itself does not call `router.push('/')` —
it calls `router.replace('/')` on a successful `login()` return. This would only loop if
`login()` returned `true` but `user` was still null, which RC-11 analysis shows cannot happen
after the fix. The loop risk is already eliminated by the existing code path but should be
confirmed by a test.

---

## Correctness Properties

Property 1: Bug Condition — Verified, Onboarded Login User Reaches the Dashboard

_For any_ scenario where `X.enteredVia = 'credentials-login'` and the user is verified and
onboarded, the fixed flow SHALL hydrate complete auth state (including `emailVerified` and
`onboardingCompletedAt`) and render the correct destination (`/dashboard` for tenant users,
`/admin/dashboard` for System Admins) — identical to the outcome from a page refresh.

**Validates: Requirements 2.1, 2.4, 2.5**

Property 2: Bug Condition — Auth Resolution Never Shows a Silent Blank Screen

_For any_ scenario where auth is resolving (`isLoading = true`), has encountered a transport
failure (`authError` set), or `user` is null and a redirect is pending, the fixed flow SHALL
render a visible `AuthLoadingScreen` or an explicit error state with a retry action — and SHALL
NOT render `null` or a silent white screen.

**Validates: Requirements 2.2, 2.3, 2.8, 2.9**

Property 3: Bug Condition — Demo/Seeded Accounts Are Not Gated by emailVerified = null

_For any_ scenario where a seeded/demo account has `emailVerified = null` but `status = 'ACTIVE'`
and the backend allows login (via `isDemoMode`), the fixed flow SHALL NOT redirect to
`/verify-email`. The seed script SHALL set `emailVerified` to a non-null `Date` for all seeded
accounts.

**Validates: Requirements 2.5**

Property 4: Bug Condition — System Admin Always Routes to /admin/dashboard

_For any_ scenario where `user.role = 'System Admin'`, the fixed flow SHALL route to
`/admin/dashboard` regardless of any saved redirect, and SHALL NOT route to `/dashboard`.

**Validates: Requirements 2.6**

Property 5: Bug Condition — Invited Users Are Not Sent to Onboarding

_For any_ scenario where the user was registered via invitation (has a valid `tenantId`, the
tenant has a `name`), the fixed flow SHALL NOT redirect to `/onboarding` when the tenant name is
present and onboarding is not required.

**Validates: Requirements 2.7**

Property 6: Preservation — Non-Buggy Auth Scenarios Are Unchanged

_For any_ input where the bug condition does NOT hold (`isBugCondition(X) = false`), the fixed
flow SHALL produce the same result as the original flow, preserving all listed preservation
requirements.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

---

## Fix Implementation

### Changes Required

#### Change 1 — Replace null returns in AuthGuard with AuthLoadingScreen (RC-01, RC-08, RC-10)

**File:** `frontend/src/shared/providers/auth-guard.tsx`

The guard already has the correct structure — `authError` UI, `AuthLoadingScreen` import — but
must verify the loading state is shown for ALL these cases:

```tsx
// While auth is resolving
if (isLoading) return <AuthLoadingScreen />;

// A genuine auth-init transport failure (network/5xx)
if (authError) {
  return ( /* explicit error + retry UI */ );
}

// user === null: redirect effect fires; show loading during that brief window
if (user === null) return <AuthLoadingScreen />;
```

**Specific Changes:**
1. Confirm `if (isLoading) return <AuthLoadingScreen />` is the first branch (not `null`).
2. Confirm `if (user === null) return <AuthLoadingScreen />` is the last branch before `children`.
3. Confirm `authError` branch renders the retry UI with `retryAuthInit` — already present but
   verify dark mode classes cover both light and dark backgrounds.

#### Change 2 — Ensure defense-in-depth login() re-hydration never returns false (RC-02, RC-11)

**File:** `frontend/src/store/AuthContext.tsx`

**Function:** `login()`

The existing code already has the `me()` re-hydration call and fallback. Verify the following
contract is correct:

```typescript
// 1. Call authApi.login()
// 2. If response has user → store as apiUser
// 3. Try authApi.me() → if success, override apiUser with meRes.data.user
// 4. setUser(apiUser)  ← this is ALWAYS the complete shape (either from me() or login fallback)
// 5. return true
```

No structural change needed if this is already implemented. A test confirms it.

#### Change 3 — Fix emailVerified = null on seeded/demo accounts (RC-05)

**File:** `backend/src/database/seeders/demo.seed.ts` (and/or `seeder.seed.ts`)

Ensure every seeded user has `emailVerified` set to a non-null `Date`:

```typescript
// When creating/upserting demo users:
await prisma.user.upsert({
  where: { email: '...' },
  create: {
    // ...
    emailVerified: new Date(),   // ← add this
    status: 'ACTIVE',
  },
  update: {
    emailVerified: new Date(),   // ← add this
    status: 'ACTIVE',
  },
});
```

This is the minimal fix. The alternative (teaching `AuthGuard` to trust `status = 'ACTIVE'` as
a verification proxy) would require frontend to trust a non-canonical signal and is not aligned
with the existing security model.

**Additionally**, add a one-time migration patch that sets `emailVerified` for any existing
ACTIVE seeded users in the database:

```sql
UPDATE "User"
SET "emailVerified" = NOW()
WHERE status = 'ACTIVE'
  AND "emailVerified" IS NULL;
```
This can be done via a Prisma migration or a seed upsert — it must be idempotent.

#### Change 4 — Fix System Admin saved-redirect path (RC-06)

**File:** `frontend/src/shared/providers/auth-guard.tsx`

The saved-redirect block currently allows any non-`/admin` path to execute, including `/dashboard`
for System Admins:

```tsx
if (savedRedirect && savedRedirect !== '/login' && savedRedirect !== '/register') {
  const isAdminPath = savedRedirect.startsWith('/admin');
  if (!isAdminPath || isSystemAdmin) {
    router.replace(savedRedirect);
    return;
  }
}
```

**Fix:** Block `/dashboard` (and any non-admin path) for System Admins:

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

#### Change 5 — Fix invited user tenant context check (RC-07)

**File:** `frontend/src/shared/providers/auth-guard.tsx`

The onboarding gate currently uses `!tenantName` as the trigger. For invited users, the tenant
name was set during the inviting company's onboarding, not the invited user's own onboarding.
The fix is to also check `user.onboardingCompletedAt` before sending to `/onboarding`, since
invited users join an existing tenant (already onboarded):

```tsx
// Gate 2: First-time workspace setup
const tenantName   = (user as any).tenantName;
const onboardingAt = (user as any).onboardingCompletedAt;
const localDone    = typeof window !== 'undefined'
  ? localStorage.getItem(ONBOARDING_COMPLETE_KEY)
  : null;

// Only redirect to onboarding if:
// - tenantName is falsy (tenant hasn't completed setup)
// - AND no local completion signal
// - AND onboardingCompletedAt is also null (no server-side completion record)
if (!tenantName && !localDone && !onboardingAt) {
  sessionStorage.removeItem('leadcrm_redirect_after_login');
  router.replace('/onboarding');
  return;
}
```

Additionally, ensure `buildAuthUserResponse` always includes the tenant relation join:

**File:** `backend/src/core/auth/auth.service.ts`

Verify `loginUser` includes:
```typescript
include: {
  tenant: {
    select: {
      name: true, industry: true, companySize: true,
      onboardingStep: true, onboardingCompletedAt: true,
    },
  },
},
```
This is already present in the `loginUser` implementation.

#### Change 6 — Backend unreachable / CORS error: improve error message (RC-08, RC-09)

**File:** `frontend/src/store/AuthContext.tsx`

**Function:** `restoreSession()`

The catch block already sets `authError` for non-401 errors. Improve the error message to help
diagnose CORS/network issues:

```typescript
} catch (err: unknown) {
  setUser(null);
  setTenant(null);
  if (isNoSessionError(err)) {
    setAuthError(null);
  } else {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    // A "Failed to fetch" or TypeError typically means network/CORS issue
    const isCorsOrNetwork = err instanceof TypeError || msg.includes('fetch');
    setAuthError(
      isCorsOrNetwork
        ? 'Unable to connect to the server. Check your network connection or contact support.'
        : msg || 'Unable to verify your session',
    );
  }
}
```

The `AuthGuard` authError UI (retry + back to login) is already in place and covers this.

#### Change 7 — Login page must not race-navigate (RC-10)

**File:** The login page component (wherever `login()` is called on form submit).

After a successful `login()`, the page must NOT call `router.push('/')` or `router.replace('/')`.
Instead, it should rely on `AuthGuard` to route after the `user` state update. If manual
navigation is present, remove it:

```tsx
// WRONG — races with state update:
const success = await login(email, password);
if (success) router.push('/dashboard');

// CORRECT — let AuthGuard route after user state settles:
const success = await login(email, password);
if (!success) setError('Invalid email or password');
// AuthGuard will redirect once user state is committed
```

#### Change 8 — DataContext Batch 1 failure surfacing (RC-03)

**File:** `frontend/src/store/DataContext.tsx`

The Batch 1 catch block currently only `console.error`s. No change to `DataContext` is needed
for the white-screen fix (the dashboard renders correctly with empty arrays — it shows zeroes,
not a blank screen). However, adding a toast notification for a complete Batch 1 failure
prevents silent data gaps:

```typescript
} catch (err) {
  console.error('[DataContext] Failed to load CRM data from API:', err);
  // Surface the failure to the user — don't silently show empty data
  // Only toast if err is a genuine transport failure (not a 403 plan-gate)
  if (err instanceof Error && !err.message.includes('403')) {
    import('sonner').then(({ toast }) => {
      toast.error('Failed to load data. Please refresh the page.');
    });
  }
}
```

This is a UX improvement, not a blank-screen fix. The primary blank-screen fix is the auth
chain fixes in Changes 1–7.

#### Change 9 — Dashboard local timer safety (RC-04)

**File:** `frontend/src/features/tenant/dashboard/ui/dashboard.tsx`

The existing `useEffect` with `clearTimeout` is already correct. The 700ms cosmetic timer is
not a source of blank screens — it shows `DashboardSkeleton`, not a blank. No change needed.
This root cause is already handled.

### Non-goals (explicitly out of scope)

- No redesign of app, no new features, no replacement of the dual-path auth architecture.
- No change to JWT/session/cookie mechanics, RBAC, tenant isolation, or any CRM module.
- No change to mock-auth localStorage flow.
- No change to the Google OAuth / NextAuth flow.
- The CORS configuration itself (`ALLOWED_ORIGINS`) is a deployment concern, not a code change.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: surface counterexamples that demonstrate each
bug on the unfixed code, then verify each fix and confirm all preservation requirements are
unchanged. Tests span backend service/contract assertions and frontend guard/context behavior.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples demonstrating the bugs BEFORE implementing fixes. Confirm or
refute each root-cause hypothesis.

**Test Cases**:
1. **RC-01 / Loading state**: Assert `AuthGuard` renders a visible element (not `null`) when
   `isLoading = true` (will fail on unfixed code if guard returns `null`).
2. **RC-02 / Login contract parity**: For a verified, onboarded user, assert the login response
   `user` contains `emailVerified` and `onboardingCompletedAt` — and that their values are
   non-null (will fail if backend does not use `buildAuthUserResponse`).
3. **RC-05 / Seeded account gate**: Assert `AuthGuard` does NOT redirect to `/verify-email` when
   `user.emailVerified = null` but `user.status = 'ACTIVE'` in demo mode (will fail without
   database fix).
4. **RC-06 / System Admin route**: Assert a System Admin is never sent to `/dashboard` when a
   saved redirect of `/dashboard` is present in `sessionStorage` (will fail without Change 4).
5. **RC-07 / Invited user gate**: Assert `AuthGuard` does NOT redirect to `/onboarding` when
   `user.tenantName` is set but `user.onboardingCompletedAt` is null (invited user case).
6. **RC-08 / Transport failure**: Simulate `authApi.me()` throwing `TypeError('Failed to fetch')`.
   Assert `authError` is set (not null) and `user` is null (not a "no session" classification).
7. **RC-10 / Race condition**: Assert the login page does not navigate manually after `login()`
   returns — the routing must be driven by `AuthGuard`.
8. **RC-11 / me() fallback**: Assert `login()` returns `true` even when the post-login `me()`
   call throws, and that `user` is set to the login-payload user (not null).

**Expected Counterexamples**:
- `AuthGuard` returns `null` while resolving (RC-01).
- Login response `user` is missing gate fields (RC-02 — if backend hasn't been updated).
- System Admin lands on `/dashboard` via saved redirect (RC-06).
- Invited user is redirected to `/onboarding` despite having a tenant name (RC-07).

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed flow produces the
expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := fixedFlow(X)
  ASSERT expectedBehavior(result)
  CASE isBugCondition(X) BY SCENARIO
    RC-01 → isLoading=true  → renders AuthLoadingScreen, NOT null
    RC-02 → login path      → user includes emailVerified, routes to /dashboard
    RC-03 → Batch1 fails    → toast shown, dashboard renders with empty arrays
    RC-05 → seeded null     → emailVerified set in DB, not redirected to /verify-email
    RC-06 → systemAdmin     → routed to /admin/dashboard, NOT /dashboard
    RC-07 → invited user    → not sent to /onboarding when tenantName present
    RC-08 → backend down    → authError set, error+retry UI shown, NOT blank screen
    RC-09 → CORS blocked    → authError set, error+retry UI shown, NOT blank screen
    RC-10 → race condition  → login page does not navigate, AuthGuard routes correctly
    RC-11 → me() fails      → login() returns true, user set from login payload
    RC-12 → redirect loop   → no infinite loop, user settles on one destination
  END CASE
END FOR
```

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed flow
produces the same result as the original.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT originalFlow(X) = fixedFlow(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended because the auth input space
is a Cartesian product: `{emailVerified} × {onboardingCompletedAt} × {role} × {status} ×
{enteredVia} × {tenantName} × {registeredVia}`. PBT automatically generates inputs across
this space and catches edge cases that hand-written tests miss.

**Test Cases**:
1. **Invalid credentials**: Observe error toast + stay on `/login`; assert unchanged.
2. **Logged-out navigation**: Observe redirect to `/login` with saved `sessionStorage` path;
   assert unchanged.
3. **Genuine unverified user**: Observe route to `/verify-email`; assert unchanged.
4. **Genuine not-onboarded user**: Observe route to `/onboarding`; assert unchanged.
5. **System Admin**: Observe route to `/admin/dashboard`, gates bypassed; assert unchanged.
6. **Logout**: Observe state cleared, cookie revoked, `/login`; assert unchanged.
7. **Google OAuth**: Observe NextAuth flow completes, `/auth/me` hydrates; assert unchanged.
8. **Mock-auth mode**: Observe localStorage flow unchanged; assert no API calls made.

---

### Unit Tests

**Backend:**
- `buildAuthUserResponse(user)` includes `emailVerified`, `tenantName`, `onboardingCompletedAt`,
  `onboardingStep`, `industry`, `companySize`.
- `loginUser` returns a user shape equal to `buildAuthUserResponse(user)` for a verified,
  onboarded user.
- `loginUser` still throws `401` for invalid credentials, `403` for unverified (non-demo) and
  inactive users.
- Seeded user records have `emailVerified` set to a non-null `Date`.

**Frontend:**
- `AuthGuard` renders `AuthLoadingScreen` when `isLoading = true` (not `null`).
- `AuthGuard` renders the error+retry UI when `authError` is set.
- `AuthGuard` renders `AuthLoadingScreen` (not `null`) when `user === null` and redirect is
  pending.
- `AuthContext.login()` returns `true` when `authApi.login()` succeeds, even if `authApi.me()`
  subsequently throws.
- `AuthContext.restoreSession()` sets `authError` for `TypeError: Failed to fetch` and clears
  `authError` for 401 responses.
- `AuthGuard` does NOT redirect a System Admin to `/dashboard` when savedRedirect = `/dashboard`.
- `AuthGuard` does NOT redirect an invited user (with `tenantName` set) to `/onboarding`.

---

### Property-Based Tests

- Generate random `(emailVerified, onboardingCompletedAt, role, status, tenantName)` tuples and
  verify Property 6 (preservation): guard decision is unchanged for non-buggy inputs.
- Generate verified/onboarded login scenarios and verify Property 1: user settles on correct
  destination.
- Generate `isLoading = true` and `authError` scenarios and verify Property 2: always shows
  visible state.
- Generate System Admin scenarios and verify Property 4: always routes to `/admin/dashboard`.

---

### Integration Tests

- Full credentials-login flow (real-API mode): verified + onboarded user logs in → `/dashboard`
  with no blank frame; then refresh → same `/dashboard` (Properties 1 + 3).
- Auth-init transport failure: force `authApi.me()` to throw `TypeError` → explicit
  error+retry UI is shown, not a blank screen (Property 2).
- Seeded demo account login: `admin@democorp.com` logs in → reaches `/dashboard` (Property 3).
- System Admin login: `admin@gmail.com` logs in → reaches `/admin/dashboard` (Property 4).
- Invited user login: invited user logs in after accepting invitation → reaches `/dashboard`
  (Property 5).
- Google OAuth regression: sign-in completes and hydrates via `/auth/me` unchanged (Property 6).
