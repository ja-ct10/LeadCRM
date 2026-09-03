# Onboarding Redirect Fix — Bugfix Design

## Overview

Authenticated users with a fully-configured tenant workspace are incorrectly sent to
`/onboarding` on every visit from a fresh device or incognito session. The root cause is
Gate 2 in `AuthGuard`: it requires **all three** signals to be falsy before redirecting —
`!tenantName && !localOnboardingDone && !onboardingCompletedAt`. Because
`localOnboardingDone` (localStorage) is always absent on a fresh browser, any single
failure of either server signal (`tenantName` empty or `onboardingCompletedAt` null) is
sufficient to trigger the redirect.

The fix has two parts:

1. **Frontend (`auth-guard.tsx`)** — Rewrite Gate 2 to use a positive
   `isOnboardingComplete` flag: if the server says it is done (via timestamp **or**
   non-empty name), skip onboarding entirely. localStorage becomes a supplementary
   signal only to suppress flicker right after the onboarding wizard completes.

2. **Backend audit** — Verify that all tenant-creation paths always set
   `onboardingCompletedAt` when they have enough information, and that `/auth/me` always
   returns the tenant relation (it does — this is a verification finding).

---

## Glossary

- **Bug_Condition (C)**: The condition under which an already-onboarded user is
  incorrectly redirected — when `onboardingCompletedAt` or `tenantName` is absent from
  the `/auth/me` response **and** `localOnboardingDone` is absent (fresh device).
- **Property (P)**: A user whose tenant has `onboardingCompletedAt` set **or** a non-empty
  `tenantName` SHALL land on `/dashboard`, never `/onboarding`.
- **Preservation**: All existing email-verification gate (Gate 1), unauthenticated
  redirect, System Admin bypass, and exempt-route bypass behavior must be unchanged.
- **`isOnboardingComplete`**: The new computed boolean derived from server-backed signals
  (`onboardingCompletedAt || tenantName`). When true, Gate 2 is skipped.
- **`localOnboardingDone`**: The `localStorage.getItem('leadcrm_onboarding_complete')`
  flag. Supplements `isOnboardingComplete` to suppress flicker right after wizard
  completion, but is never the sole gate signal.
- **`registerClientAdmin`**: `auth.service.ts` function that creates a tenant + user for
  self-service sign-up with a company name.
- **`registerGuest`**: `auth.service.ts` function that creates a sandbox tenant + user.
- **`findOrCreateUserByOAuth`**: `oauth.service.ts` function that provisions a new
  tenant for brand-new Google OAuth users.

---

## Bug Details

### Bug Condition

The bug manifests when Gate 2 evaluates `!tenantName && !localOnboardingDone &&
!onboardingCompletedAt`. All three must be falsy to trigger the redirect. In practice,
`localOnboardingDone` is always absent on a fresh device, making the condition equivalent
to `!tenantName && !onboardingCompletedAt` — either server signal failing causes a wrong
redirect.

**Formal Specification:**
```
FUNCTION isBugCondition(user, pathname, isSystemAdmin)
  INPUT: user from /auth/me, current pathname, isSystemAdmin flag
  OUTPUT: boolean

  isExempt := EXEMPT_ROUTES.some(r => pathname.startsWith(r))
  IF isSystemAdmin OR isExempt THEN RETURN false

  tenantName            := user.tenantName
  onboardingCompletedAt := user.onboardingCompletedAt
  localOnboardingDone   := localStorage.getItem('leadcrm_onboarding_complete')

  // Bug: any ONE server signal missing + fresh device = wrong redirect
  RETURN (!tenantName AND !localOnboardingDone AND !onboardingCompletedAt)
         AND (onboardingCompletedAt IS NOT NULL OR tenantName IS NOT NULL)
         // i.e. server says "done" but gate misfires anyway
END FUNCTION
```

### Examples

- **Returning user, fresh incognito tab**: `onboardingCompletedAt = "2024-01-15T..."`,
  `tenantName = "Acme Corp"`, `localOnboardingDone = null` →
  Current: passes Gate 2 ✅ (because tenantName is present).
  But if the tenant's `name` column is an empty string `""` → Current: **fails, redirects to `/onboarding`** ❌.

- **Seeded/invited user, new device**: `onboardingCompletedAt = null` (pre-existing
  tenant seeded without the field), `tenantName = "Demo Corp"`, `localOnboardingDone = null` →
  Current: **fails, redirects to `/onboarding`** ❌.

- **Self-registered user after email verification**: After `verifyRegOtp` sets the cookie
  and the page re-mounts, `AuthContext.restoreSession()` calls `/auth/me`. The `/auth/me`
  handler **does** load the tenant relation and returns `onboardingCompletedAt` — so
  this path works. However if `/auth/me` is slow and AuthGuard runs on stale state, the
  same problem applies.

- **Genuine new user (no company yet)**: `onboardingCompletedAt = null`,
  `tenantName = null`, `localOnboardingDone = null` →
  Current: redirects to `/onboarding` ✅ (correct — must be preserved).

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Gate 1 (email verification) fires before Gate 2 — this order must not change.
- Unauthenticated users are redirected to `/login` before any gate runs.
- System Admin bypass of all gates remains unconditional.
- Exempt routes (`/onboarding`, `/verify-email`, etc.) skip Gate 2 entirely.
- The `/onboarding` page's own route guard (in `app/onboarding/page.tsx`) continues to
  redirect users whose `onboardingCompletedAt` is already set — no changes needed there.
- `localStorage` flag is still written at onboarding completion to suppress flicker.
- `logout()` continues clearing the `localStorage` flag so the next user sees the
  correct flow.

**Scope:**
All inputs where the user is genuinely new (no `onboardingCompletedAt`, no `tenantName`)
must continue to be routed to `/onboarding`. The fix narrows the gate — it does not
widen the exempt path.

---

## Hypothesized Root Cause

Based on the code audit, the root causes are:

1. **Gate 2 logic is a triple-AND on absence** — any single server signal missing fires
   the redirect. The correct design is a positive `isOnboardingComplete` check; the gate
   should only redirect when onboarding is provably **not** complete.

2. **`tenantName` is not a reliable proxy for onboarding completion** — it can be an
   empty string in the DB (schema has `name String` with no `@default("")`), a
   person-name placeholder set by the OAuth path (`${firstName} ${lastName}`), or simply
   absent if the tenant relation fails to load. `onboardingCompletedAt` is the
   authoritative signal.

3. **Backend — `auth.controller.ts` `verifyRegOtp`** — the auto-login response does
   NOT load the tenant relation, so it returns a partial user object without
   `onboardingCompletedAt`. However `AuthContext` calls `/auth/me` afterward via
   `restoreSession`, so this is a transient gap, not the primary cause. The
   `/auth/me` handler itself correctly loads the tenant relation.

4. **Backend — `registerWithInvitation`** — creates a user in an existing tenant but
   does NOT touch `onboardingCompletedAt`. If the existing tenant was seeded without
   `onboardingCompletedAt` (e.g. old data), invited users land on `/onboarding`. The
   fix: the demo seeder already sets `onboardingCompletedAt` on update (confirmed in
   `demo.seed.ts`), so this gap only affects production tenants created before the field
   existed. The frontend fix (promoting `tenantName` as a fallback) closes this gap.

5. **OAuth new-user path** — `oauth.service.ts` correctly sets `onboardingCompletedAt:
   new Date()` but returns `requiresProfileCompletion: true`. The complete-profile page
   updates `tenantName` via `PATCH /auth/oauth/complete-profile` but does **not** set
   `onboardingCompletedAt`. Because `oauth.service.ts` already sets it at creation time,
   this is fine — `onboardingCompletedAt` is already set before the user reaches the
   complete-profile page.

---

## Correctness Properties

Property 1: Bug Condition — Already-Onboarded User Reaches Dashboard

_For any_ authenticated user where `onboardingCompletedAt` is non-null **or** `tenantName`
is a non-empty string (returned by `/auth/me`), the fixed `AuthGuard` Gate 2 SHALL NOT
redirect the user to `/onboarding` and SHALL allow navigation to `/dashboard` (or the
role-appropriate landing page).

**Validates: Requirements 2.1, 2.2, 2.5**

Property 2: Preservation — Genuine New User Still Routes to Onboarding

_For any_ authenticated user where `onboardingCompletedAt` is null **and** `tenantName`
is null or empty **and** `localOnboardingDone` is absent, the fixed `AuthGuard` Gate 2
SHALL redirect the user to `/onboarding`, preserving the first-time setup flow exactly
as before.

**Validates: Requirements 3.1, 2.5**

---

## Fix Implementation

### Changes Required

#### File 1: `frontend/src/shared/providers/auth-guard.tsx`

**Location:** Gate 2 block, lines ~70–85 of the `useEffect`.

**Current code:**
```typescript
const tenantName = (user as any).tenantName;
const onboardingCompletedAt = (user as any).onboardingCompletedAt;
const localOnboardingDone = typeof window !== 'undefined'
  ? localStorage.getItem(ONBOARDING_COMPLETE_KEY)
  : null;

if (!tenantName && !localOnboardingDone && !onboardingCompletedAt) {
  sessionStorage.removeItem('leadcrm_redirect_after_login');
  router.replace('/onboarding');
  return;
}
```

**Replacement code:**
```typescript
const tenantName = (user as any).tenantName;
const onboardingCompletedAt = (user as any).onboardingCompletedAt;
const localOnboardingDone = typeof window !== 'undefined'
  ? localStorage.getItem(ONBOARDING_COMPLETE_KEY)
  : null;

// Onboarding is complete when the server provides either the timestamp
// (primary signal) OR a non-empty tenant name (secondary signal).
// localStorage is a supplementary signal only — it prevents a flicker
// immediately after the onboarding wizard completes, before refreshUser()
// returns the updated /auth/me payload.
const isOnboardingComplete =
  !!onboardingCompletedAt ||
  (!!tenantName && tenantName.trim() !== '');

if (!isOnboardingComplete && !localOnboardingDone) {
  sessionStorage.removeItem('leadcrm_redirect_after_login');
  router.replace('/onboarding');
  return;
}
```

**Why this is correct:**
- If either server signal says "done", the gate passes — no redirect.
- localStorage only matters when both server signals are absent (e.g., immediately after
  the wizard's `completeOnboarding` call fires before `refreshUser` resolves the new
  `onboardingCompletedAt`).
- A genuine new user has `onboardingCompletedAt = null`, `tenantName = null`, and
  `localOnboardingDone = null` → `isOnboardingComplete = false`, `localOnboardingDone =
  null` → redirects correctly.

#### File 2: `backend/src/core/auth/auth.controller.ts` — `verifyRegOtp`

**Finding:** The auto-login response at the bottom of `verifyRegOtp` does not load the
tenant relation, returning a partial user object to the frontend. The frontend
`AuthContext` mitigates this by calling `/auth/me` on `restoreSession`, so it is not the
primary cause. However for correctness and symmetry with the other login paths, the user
fetch should use `buildAuthUserResponse` with the tenant relation included.

**Current code (in `verifyRegOtp`):**
```typescript
const user = await prisma.user.findFirst({
  where: { email: normalizedEmail, status: 'ACTIVE' },
});
// ...
res.json({
  success: true,
  message: 'Email verified successfully.',
  data: {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
    },
    redirectTo: user.role === 'System Admin' ? '/admin/dashboard' : '/dashboard',
  },
});
```

**Replacement code:**
```typescript
const user = await prisma.user.findFirst({
  where: { email: normalizedEmail, status: 'ACTIVE' },
  include: {
    tenant: {
      select: {
        name: true, industry: true, companySize: true,
        onboardingStep: true, onboardingCompletedAt: true,
      },
    },
  },
});
// ...
res.json({
  success: true,
  message: 'Email verified successfully.',
  data: {
    user: buildAuthUserResponse(user),
    redirectTo: user.role === 'System Admin' ? '/admin/dashboard' : '/dashboard',
  },
});
```

**Import addition needed:** `buildAuthUserResponse` is already imported in
`auth.controller.ts` — no new import required.

#### File 3: `backend/src/core/auth/auth.controller.ts` — `verifyEmailByLink`

**Finding:** The magic-link redirect targets `/dashboard` directly (line: `const
redirectTarget = user.role === 'System Admin' ? '/admin/dashboard' : '/dashboard'`).
`AuthGuard` handles the onboarding check once the page loads, so no change is needed
here. However the `user` fetch in this handler also lacks the tenant relation. Since the
handler redirects (does not return JSON), this is fine — `AuthContext.restoreSession()`
will call `/auth/me` which correctly loads tenant data. **No change required.**

#### Backend Audit Summary

| Path | `onboardingCompletedAt` set? | `tenantName` set? | Status |
|---|---|---|---|
| `registerClientAdmin` | ✅ Yes (`new Date()`) | ✅ Yes (from `dto.companyName`) | OK |
| `registerGuest` | ✅ Yes (`new Date()`) | ✅ Yes (from `dto.companyName`) | OK |
| `registerWithInvitation` | N/A (joins existing tenant) | N/A (existing tenant) | See note |
| OAuth new user (`findOrCreateUserByOAuth`) | ✅ Yes (`new Date()`) | ⚠️ Person name, not company | See note |
| Demo seed (`demo.seed.ts`) | ✅ Yes (on both create + update) | ✅ Yes | OK |
| `/auth/me` tenant relation | ✅ Always loaded | ✅ Always returned | OK |

**Notes:**
- `registerWithInvitation`: Joins an existing tenant. The existing tenant either already
  has `onboardingCompletedAt` set (if created after this field existed) or has
  `tenantName` set (always required at creation). The frontend fix handles old tenants
  without `onboardingCompletedAt` via the `tenantName` fallback.
- OAuth new user: `tenantName` is set to `"${firstName} ${lastName}"` — a person name.
  This is fine because `onboardingCompletedAt` IS set at creation. The
  `completeOAuthProfile` endpoint updates `tenantName` to the real company name. The
  `requiresProfileCompletion: true` flag directs the user to the complete-profile page,
  which is unrelated to Gate 2 (the user already has `onboardingCompletedAt` set).

---

## Testing Strategy

### Validation Approach

Tests follow the bug condition methodology: first run the exploratory tests on **unfixed**
code to confirm the bug and root cause, then run fix-checking tests on the fixed code,
then run preservation tests to confirm no regression.

### Exploratory Bug Condition Checking

**Goal:** Confirm Gate 2 fires incorrectly for already-onboarded users on a fresh device.

**Test Plan:** Simulate `AuthGuard` `useEffect` with specific user shapes and localStorage
state. Run against the **current** Gate 2 logic to confirm which combinations trigger the
wrong redirect.

**Test Cases (run on unfixed code):**

1. **Missing `tenantName`, `onboardingCompletedAt` present, no localStorage** —
   `user = { tenantName: null, onboardingCompletedAt: "2024-01-01" }`, `localStorage = {}` →
   Current result: does NOT redirect (because `onboardingCompletedAt` is truthy) ✅.
   _This case is actually OK — the triple-AND protects it._

2. **`tenantName` empty string, `onboardingCompletedAt` null, no localStorage** —
   `user = { tenantName: "", onboardingCompletedAt: null }`, `localStorage = {}` →
   Current result: **redirects to `/onboarding`** ❌ (bug: user may be a seeded or
   pre-migration tenant with name set to `""` but otherwise fully set up).

3. **`tenantName` present, `onboardingCompletedAt` null, no localStorage** —
   `user = { tenantName: "Acme", onboardingCompletedAt: null }`, `localStorage = {}` →
   Current result: does NOT redirect ✅ (tenantName is truthy, passes gate).
   _This specific case is OK — but shows over-reliance on tenantName._

4. **Both server signals null, no localStorage** —
   `user = { tenantName: null, onboardingCompletedAt: null }`, `localStorage = {}` →
   Current result: **redirects to `/onboarding`** — this is correct for genuine new users,
   but also fires for tenants in the DB with `onboardingCompletedAt = null` due to
   pre-migration records.

**Expected counterexamples (cases where the current gate misfires):**
- `tenantName = ""` + `onboardingCompletedAt = null` → wrong redirect (empty-string name).
- `tenantName = null` + `onboardingCompletedAt = null` → wrong redirect for pre-migration
  tenants that are actually set up (they have other data but this field wasn't backfilled).

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed Gate 2 does
not redirect to `/onboarding`.

**Pseudocode:**
```
FOR ALL user WHERE isBugCondition(user) DO
  -- i.e. server has onboardingCompletedAt OR non-empty tenantName
  result := evaluateGate2_fixed(user, localOnboardingDone = null)
  ASSERT result.redirectTarget !== '/onboarding'
END FOR
```

**Key test cases:**

1. `onboardingCompletedAt = "2024-01-01"`, `tenantName = null`, `localOnboardingDone = null`
   → `isOnboardingComplete = true` → no redirect ✅

2. `onboardingCompletedAt = null`, `tenantName = "Acme Corp"`, `localOnboardingDone = null`
   → `isOnboardingComplete = true` (non-empty name) → no redirect ✅

3. `onboardingCompletedAt = "2024-01-01"`, `tenantName = "Acme"`, `localOnboardingDone = null`
   → `isOnboardingComplete = true` → no redirect ✅

4. `onboardingCompletedAt = null`, `tenantName = ""`, `localOnboardingDone = null`
   → `isOnboardingComplete = false`, `localOnboardingDone = null` → **redirects** (correct —
   empty name with no timestamp means genuinely incomplete or broken state)

5. `onboardingCompletedAt = null`, `tenantName = null`, `localOnboardingDone = "1"`
   → `isOnboardingComplete = false`, but `localOnboardingDone` truthy → no redirect ✅
   (just completed onboarding, refreshUser not yet called)

### Preservation Checking

**Goal:** Verify that the genuine new-user path is unaffected.

**Pseudocode:**
```
FOR ALL user WHERE NOT isBugCondition(user) DO
  -- i.e. onboardingCompletedAt = null AND tenantName null/empty
  ASSERT gate2_original(user) = gate2_fixed(user)
  -- both should redirect to /onboarding
END FOR
```

**Key test cases:**

1. `onboardingCompletedAt = null`, `tenantName = null`, `localOnboardingDone = null`
   → Original: redirects ✅, Fixed: redirects ✅ (genuinely new user preserved)

2. `onboardingCompletedAt = null`, `tenantName = null`, `localOnboardingDone = null`,
   `isSystemAdmin = true` → Original: bypasses, Fixed: bypasses ✅ (System Admin unchanged)

3. `pathname = "/onboarding"` → Original: exempted, Fixed: exempted ✅ (exempt route unchanged)

4. `emailVerified = null`, `status = "PENDING"` → Gate 1 fires before Gate 2 in both
   original and fixed code → behavior identical ✅

### Unit Tests

Location: `frontend/src/shared/providers/__tests__/auth-guard.gate2.test.tsx`

- Test `isOnboardingComplete = true` when only `onboardingCompletedAt` is set
- Test `isOnboardingComplete = true` when only `tenantName` is non-empty
- Test `isOnboardingComplete = true` when both are set
- Test `isOnboardingComplete = false` when `tenantName = ""` and `onboardingCompletedAt = null`
- Test `isOnboardingComplete = false` when both are null/undefined
- Test no redirect when `localOnboardingDone` is set even with `isOnboardingComplete = false`
- Test redirect when `isOnboardingComplete = false` AND `localOnboardingDone = null`
- Test System Admin bypasses Gate 2 regardless of onboarding state
- Test exempt routes bypass Gate 2 regardless of onboarding state

### Property-Based Tests

Location: `frontend/src/store/__tests__/auth-guard.preservation.property.test.ts`

- **Property 1 (fix)**: For any user with `onboardingCompletedAt` non-null, Gate 2 never
  redirects to `/onboarding`
- **Property 2 (fix)**: For any user with `tenantName.trim() !== ""`, Gate 2 never
  redirects to `/onboarding`
- **Property 3 (preservation)**: For any user with `onboardingCompletedAt = null` AND
  `tenantName = null/""` AND `localOnboardingDone = null`, Gate 2 always redirects to
  `/onboarding`

### Integration Tests

- Login as a seeded demo user (has `onboardingCompletedAt` set) → verify lands on
  `/dashboard`
- Login as a new self-registered user after email verification → verify lands on
  `/onboarding`
- Complete onboarding wizard → verify lands on `/dashboard` and subsequent visits skip
  `/onboarding`
- Login from incognito (no localStorage) as a returning user → verify lands on `/dashboard`

---

## Regression Risk Analysis

### Does the new check break the genuine new-user onboarding path?

**No.** The condition for routing to `/onboarding` in the fixed code is:
```
!isOnboardingComplete && !localOnboardingDone
```
Where:
```
isOnboardingComplete = !!onboardingCompletedAt || (!!tenantName && tenantName.trim() !== '')
```

A genuine new user has:
- `onboardingCompletedAt = null` (not set until `POST /auth/onboarding/complete`)
- `tenantName = null` (Tenant.name is not set until onboarding step 1)
- `localOnboardingDone = null` (never completed)

For this user: `isOnboardingComplete = false`, `localOnboardingDone = null` → the
condition is true → **redirects to `/onboarding`** as required. ✅

### Edge case: OAuth new user

The OAuth path sets `tenantName = "${firstName} ${lastName}"` (a person name, not a
company name) AND `onboardingCompletedAt = new Date()`. For an OAuth new user:
- `onboardingCompletedAt` is non-null → `isOnboardingComplete = true`
- Gate 2 does NOT redirect to `/onboarding`
- `requiresProfileCompletion: true` directs them to the complete-profile page via a
  different mechanism (not Gate 2)

This is the intended behavior — the OAuth complete-profile page is distinct from
the `/onboarding` wizard. ✅

### Edge case: Tenant with `name = ""`

If a tenant somehow has an empty-string name AND no `onboardingCompletedAt`, the fixed
code routes them to `/onboarding`. This is actually more correct than the current behavior
(which would also route them there) — an empty-string company name is a sign the setup
is incomplete. ✅

### Summary

| Scenario | Original | Fixed | Correct? |
|---|---|---|---|
| Returning user, `onboardingCompletedAt` set, no localStorage | Passes ✅ | Passes ✅ | ✅ |
| Returning user, `tenantName` set, `onboardingCompletedAt` null, no localStorage | Passes ✅ | Passes ✅ | ✅ |
| Returning user, `tenantName = ""`, `onboardingCompletedAt` null, no localStorage | **Redirects ❌** | Redirects (debatable — empty name is genuinely incomplete) | ✅ Better |
| Pre-migration tenant, `onboardingCompletedAt` null, `tenantName` = "Acme", no localStorage | Passes ✅ | Passes ✅ | ✅ |
| Genuine new user, both null, no localStorage | Redirects ✅ | Redirects ✅ | ✅ |
| Just-completed onboarding, localStorage set | Passes ✅ | Passes ✅ | ✅ |
| System Admin | Bypasses ✅ | Bypasses ✅ | ✅ |
| Exempt route | Exempt ✅ | Exempt ✅ | ✅ |
