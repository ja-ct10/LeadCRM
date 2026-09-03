# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Already-Onboarded User Incorrectly Redirected to /onboarding
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate Gate 2 fires for already-onboarded users on a fresh device
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases:
    - `tenantName = ""` + `onboardingCompletedAt = null` + `localOnboardingDone = null` (empty-string name triggers wrong redirect)
    - `tenantName = "Acme"` + `onboardingCompletedAt = null` + `localOnboardingDone = null` (missing timestamp alone can misfire in certain edge cases)
  - Create test file at `frontend/src/shared/providers/__tests__/auth-guard.gate2.test.tsx`
  - Test that the current Gate 2 condition `(!tenantName && !localOnboardingDone && !onboardingCompletedAt)` redirects to `/onboarding` when `tenantName = ""` even though the user is already set up
  - Run test on UNFIXED `auth-guard.tsx`
  - **EXPECTED OUTCOME**: Test FAILS (this proves the bug — the current triple-AND gate misfires when tenantName is an empty string or when onboardingCompletedAt is missing for pre-migration tenants)
  - Document counterexamples found (e.g., `{ tenantName: "", onboardingCompletedAt: null }` triggers redirect for a returning user)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Genuine New User Still Routes to /onboarding
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED `auth-guard.tsx` for non-buggy inputs (cases where the user genuinely has no onboarding data)
  - Observe: `{ tenantName: null, onboardingCompletedAt: null, localOnboardingDone: null }` → redirects to `/onboarding` on unfixed code
  - Observe: `{ role: "System Admin", tenantName: null, onboardingCompletedAt: null }` → bypasses Gate 2 on unfixed code
  - Observe: `pathname = "/onboarding"` (exempt route) → bypasses Gate 2 on unfixed code
  - Observe: `{ emailVerified: null, status: "PENDING" }` → Gate 1 fires before Gate 2 on unfixed code
  - Write property-based tests capturing these observed behaviors (from Preservation Requirements 3.1–3.5 in bugfix.md):
    - For all users with `onboardingCompletedAt = null` AND `tenantName = null/""` AND `localOnboardingDone = null`: Gate 2 redirects to `/onboarding`
    - For all System Admins: Gate 2 is always bypassed regardless of onboarding state
    - For all exempt routes: Gate 2 is never triggered
    - For all unverified users (emailVerified null, status PENDING): Gate 1 redirects before Gate 2 can run
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms the baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix for onboarding redirect false-positive (already-onboarded users sent to /onboarding)

  - [ ] 3.1 Rewrite AuthGuard Gate 2 to use positive isOnboardingComplete signal
    - File: `frontend/src/shared/providers/auth-guard.tsx`
    - Replace the Gate 2 block (the `if (!tenantName && !localOnboardingDone && !onboardingCompletedAt)` condition) with:
      ```typescript
      const isOnboardingComplete =
        !!onboardingCompletedAt ||
        (!!tenantName && tenantName.trim() !== '');

      if (!isOnboardingComplete && !localOnboardingDone) {
        sessionStorage.removeItem('leadcrm_redirect_after_login');
        router.replace('/onboarding');
        return;
      }
      ```
    - Update the JSDoc comment block above Gate 2 to document the new signal priority:
      - Primary signal: `onboardingCompletedAt` (server timestamp — authoritative)
      - Secondary signal: non-empty `tenantName` (fallback for pre-migration tenants without the timestamp)
      - Supplementary signal: `localOnboardingDone` (localStorage — suppresses flicker immediately after wizard completes before `refreshUser` resolves)
    - _Bug_Condition: isBugCondition(user) where `(!tenantName OR tenantName = "") AND !onboardingCompletedAt AND !localOnboardingDone`_
    - _Expected_Behavior: `isOnboardingComplete = true` when server provides either timestamp OR non-empty tenantName → no redirect to /onboarding_
    - _Preservation: Gate 1 (email verification) order unchanged; System Admin bypass unchanged; exempt routes unchanged; genuine new users (all signals null) still redirected to /onboarding_
    - _Requirements: 2.1, 2.2, 2.5, 3.1, 3.3, 3.4_

  - [ ] 3.2 Fix verifyRegOtp to return canonical auth user shape with tenant relation
    - File: `backend/src/core/auth/auth.controller.ts`
    - In the `verifyRegOtp` handler, update the `prisma.user.findFirst` call to include the tenant relation:
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
      ```
    - Replace the inline user object literal in the `res.json` call with `buildAuthUserResponse(user)` (already imported in the file)
    - `buildAuthUserResponse` is already imported at the top of `auth.controller.ts` — no new import needed
    - This ensures the OTP verification auto-login response has the same shape as `POST /auth/login` and `GET /auth/me`
    - _Bug_Condition: `verifyRegOtp` response lacking `onboardingCompletedAt` from tenant relation_
    - _Expected_Behavior: Response includes full `AuthUserResponse` shape with tenant fields flattened_
    - _Preservation: Session creation, cookie setting, and redirectTo logic unchanged_
    - _Requirements: 2.3, 2.5_

  - [ ] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Already-Onboarded User Reaches Dashboard
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: `onboardingCompletedAt` set OR non-empty `tenantName` → `isOnboardingComplete = true` → no redirect
    - Run bug condition exploration test from step 1 against the FIXED `auth-guard.tsx`
    - **EXPECTED OUTCOME**: Test PASSES (confirms the fix resolves the false-positive redirect)
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Genuine New User Still Routes to /onboarding
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2 against the FIXED `auth-guard.tsx`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — genuine new users still reach /onboarding, System Admin bypass intact, exempt routes intact, Gate 1 order preserved)
    - Confirm all tests still pass after fix

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run `npm --prefix frontend run lint` to confirm no TypeScript errors in `auth-guard.tsx`
  - Run `npm --prefix backend run lint` to confirm no TypeScript errors in `auth.controller.ts`
  - Ensure all property-based and unit tests in `frontend/src/shared/providers/__tests__/auth-guard.gate2.test.tsx` pass
  - Verify the following scenarios manually or via integration test:
    - Returning user with `onboardingCompletedAt` set + fresh incognito → lands on `/dashboard`
    - Returning user with only `tenantName` set + fresh incognito → lands on `/dashboard`
    - Genuine new user (all signals null) → redirected to `/onboarding`
    - System Admin → bypasses Gate 2, lands on `/admin/dashboard`
  - Ask the user if questions arise

- [ ] 5. Seeder cleanup — reduce demo accounts to System Admin only

  **Context:** The seeder currently creates 5 demo accounts across 3 tenants
  (`leadcrm-system-demo`, `demo-corp`, `sandbox-guest`). Only the `leadcrm-system-demo`
  tenant and its `admin@gmail.com` System Admin account are needed going forward.
  Sub-tasks 5.1–5.4 stop creating the removed accounts on future seed runs.
  Sub-task 5.8 provides a one-time cleanup script to remove orphaned data that already
  exists in the database. The seeder itself must remain idempotent — re-running it on a
  DB that never had (or already had cleaned up) these records must not throw.

  - [ ] 5.1 Strip `super@leadcrm.com` alias upsert from `demo.seed.ts`
    - File: `backend/src/database/seeders/demo.seed.ts`
    - Remove the entire `if (systemAdminEmail !== 'super@leadcrm.com') { ... }` block
      (the guard condition and the `prisma.user.upsert` for `super@leadcrm.com` inside it)
    - This is a straight deletion — no replacement logic needed; the alias served only as
      a legacy fallback and is superseded by the `SYSTEM_ADMIN_EMAIL` env var pattern
    - _Requirements: seeder creates exactly one System Admin account going forward_

  - [ ] 5.2 Strip DemoCorp client tenant section from `demo.seed.ts`
    - File: `backend/src/database/seeders/demo.seed.ts`
    - Remove the entire "2. Client Tenant (DemoCorp)" section, which includes:
      - `prisma.tenant.upsert` for slug `demo-corp` (the `clientTenant` variable)
      - `seedSystemRoles(clientTenant.id)` call
      - `prisma.account.upsert` for id `democorp-org-id`
      - The `demoUsers` array (`admin@democorp.com`, `bob@democorp.com`) and the `for` loop that upserts them
      - The sample leads/deals/pipeline block (the `if (userClientAdmin)` block and everything inside it)
    - _Requirements: no DemoCorp tenant or users created on future seed runs_

  - [ ] 5.3 Strip Guest Sandbox tenant section from `demo.seed.ts`
    - File: `backend/src/database/seeders/demo.seed.ts`
    - Remove the entire "3. Guest Sandbox Tenant" section, which includes:
      - `prisma.tenant.upsert` for slug `sandbox-guest` (the `guestTenant` variable)
      - `seedSystemRoles(guestTenant.id)` call
      - `prisma.user.upsert` for `guest@democorp.com`
    - _Requirements: no sandbox-guest tenant or guest user created on future seed runs_

  - [ ] 5.4 Update `demo.seed.ts` JSDoc and log messages to reflect single account
    - File: `backend/src/database/seeders/demo.seed.ts`
    - Replace the function-level JSDoc comment at the top of `seedDemoAccounts` to reflect
      that only one account is created:
      ```
      /**
       * seedDemoAccounts — idempotent System Admin account seeder.
       *
       * Creates/updates the System Admin account in the User table so it works
       * with the /auth/login flow.
       *
       * Required env vars:
       *   SYSTEM_ADMIN_EMAIL    (default: admin@gmail.com)
       *   SYSTEM_ADMIN_PASSWORD (required in production — never use default in prod)
       */
      ```
    - Remove the `DEV_SEED_EMAILS` line from the old JSDoc (`Required Render env vars for OTP bypass`)
    - Remove the `guestPasswordHash` variable declaration (no longer used after 5.3)
    - Update the final success log from `'[Seed] Demo accounts seeded successfully.'` to
      `'[Seed] System Admin account seeded successfully.'`
    - _Requirements: JSDoc and log output accurately describe the seeder's post-cleanup behavior_

  - [ ] 5.5 Update `prisma/seed.ts` comment
    - File: `backend/prisma/seed.ts`
    - Find the comment block on the `seedDemoAccounts()` call (lines ~26–27) that reads:
      ```
      //    Creates: admin@gmail.com, super@leadcrm.com, admin@democorp.com,
      //             bob@democorp.com, guest@democorp.com
      ```
    - Replace with:
      ```
      //    Creates: System Admin account (email controlled by SYSTEM_ADMIN_EMAIL env var,
      //             defaults to admin@gmail.com)
      ```
    - No other changes to `seed.ts`
    - _Requirements: seed entry-point comment accurately reflects what the seeder now creates_

  - [ ] 5.6 Reduce `SWITCH_ACCOUNTS` in `account-dropdown.tsx` to System Admin only
    - File: `frontend/src/features/tenant/layout/account-dropdown.tsx`
    - Remove the four entries for `super@leadcrm.com`, `admin@democorp.com`,
      `bob@democorp.com`, and `guest@democorp.com` from the `SWITCH_ACCOUNTS` array
    - Keep only the `admin@gmail.com` entry:
      ```typescript
      const SWITCH_ACCOUNTS: SwitchAccount[] = [
        { email: 'admin@gmail.com', password: 'admin123', label: 'System Admin', role: 'System Admin', initials: 'SA' },
      ];
      ```
    - Update the comment above the array from `// Exactly 5 — matches backend seed + MOCK_USERS + DEMO_EMAILS allowlist.` to:
      ```typescript
      // Single canonical demo account — matches backend seed + SYSTEM_ADMIN_EMAIL default.
      ```
    - Remove the sentence `// Passwords are the seeded values; OTP is always '000000' in DEMO_MODE.` or keep it if OTP bypass is still relevant for the remaining account (your call)
    - _Requirements: dropdown no longer shows removed accounts; System Admin switch still works_

  - [ ] 5.7 Reduce `DEMO_EMAILS` in `AuthContext.tsx` to `admin@gmail.com` only
    - File: `frontend/src/store/AuthContext.tsx`
    - In the `mockLogin` function, find the `DEMO_EMAILS` array and remove
      `'super@leadcrm.com'`, `'admin@democorp.com'`, `'bob@democorp.com'`, and
      `'guest@democorp.com'` — leaving only `'admin@gmail.com'`
    - Result:
      ```typescript
      const DEMO_EMAILS = [
        'admin@gmail.com',
      ];
      ```
    - No other changes to `AuthContext.tsx`
    - **DO NOT** modify any test files that reference these emails as fixture data
    - _Requirements: mock mode fallback reset only applies to the remaining demo account_

  - [ ] 5.8 Create `cleanup-demo-tenants.ts` one-time cleanup script
    - File: `backend/src/database/seeders/cleanup-demo-tenants.ts`
    - This script deletes orphaned data for the `demo-corp` and `sandbox-guest` tenants
      that already exist in the database. It must be run **once** against the target DB
      after deploying the updated seeder (5.1–5.3).
    - **Safety rules:**
      - All deletes are guarded: look up the tenant by slug first, skip gracefully if not found
      - Delete child records before parent records to respect FK constraints
      - Use `prisma.$transaction` to wrap all deletes for a given tenant so the operation is atomic
      - Script is idempotent — safe to run multiple times (uses `deleteMany` with `where` clauses)
      - Do NOT call `seedDemoAccounts` or any seeder from this script
    - **Deletion order per tenant** (deepest children first, matching Prisma FK graph):
      1. `WorkflowExecutionStep` (where `tenantId` in the tenant's users' executions — if applicable; use `deleteMany({ where: { tenantId } })` when tenantId column exists, otherwise skip)
      2. `DealStageHistory`, `DealAction`, `LeadDeal`, `CustomerDeal`
      3. `Activity`, `Task`, `AuditLog`, `Notification`
      4. `Deal`
      5. `Lead`, `Customer`
      6. `Stage` (scoped via Pipeline join: delete stages where `pipeline.tenantId = tenantId`)
      7. `Pipeline`
      8. `Account` (organization)
      9. `Session`, `OAuthAccount`
      10. `RolePermission`, `UserRole`, `RoleDefinition` (scoped to `tenantId`)
      11. `User`
      12. `Tenant`
    - Add a `console.log` before each `deleteMany` showing what is being deleted and for which tenant slug
    - Add a final `console.log('[Cleanup] Done.')` at the end
    - Provide a standalone runner block (`if (require.main === module)`) so it can be run with:
      `npx ts-node backend/src/database/seeders/cleanup-demo-tenants.ts`
    - _Requirements: orphaned demo-corp and sandbox-guest data cleanly removed from production DB without manual SQL_

  - [ ] 5.9 Update `DEV_SEED_EMAILS` in `backend/.env`
    - File: `backend/.env` (local dev env — do NOT touch `backend/.env.backup-before-supabase`)
    - Find the line:
      ```
      DEV_SEED_EMAILS="admin@democorp.com,bob@democorp.com,guest@democorp.com,admin@gmail.com,super@leadcrm.com,reymarkjpanes@gmail.com"
      ```
    - Replace with (keep `reymarkjpanes@gmail.com` if it's a personal dev account that should retain OTP bypass — otherwise remove it too; default safe choice is to keep it):
      ```
      DEV_SEED_EMAILS="admin@gmail.com,reymarkjpanes@gmail.com"
      ```
    - _Requirements: OTP bypass allowlist no longer includes removed demo accounts_

- [ ] 6. Add JWT_SECRET startup guard (CRITICAL)
  - File: `backend/src/server.ts`
  - The existing `REQUIRED_ENV` check validates presence but not value — a weak placeholder passes silently
  - Add the following check immediately after the existing `REQUIRED_ENV` loop (before `app.listen`):
    ```typescript
    if (process.env.JWT_SECRET === 'leadcrm-jwt-secret-minimum-32-characters-here') {
      throw new Error(
        '[Security] JWT_SECRET is still the default placeholder. ' +
        'Set a strong random secret (32+ chars) in your deployment environment.'
      );
    }
    ```
  - This causes the server to refuse to start in any environment where the default placeholder is still set
  - No changes to the `REQUIRED_ENV` array or anything else in `server.ts`
  - _Requirements: server never starts in production with the known weak JWT_SECRET default_

- [ ] 7. Fix mock-mode feature flag defaults (HIGH)
  - File: `frontend/src/lib/config.ts`
  - Current behavior: `USE_MOCK_AUTH = process.env.NEXT_PUBLIC_USE_MOCK_AUTH !== 'false'` — defaults to `true` (mock mode) when the env var is missing from the deployment environment
  - Same issue for `USE_MOCK_DATA`
  - Replace both lines with:
    ```typescript
    export const USE_MOCK_AUTH = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
    export const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
    ```
  - New behavior: mock mode is only enabled when the var is explicitly set to `'true'`. Missing var = real API mode.
  - Update the JSDoc comment block at the top of the file to document the new default:
    ```typescript
    /**
     * App-level feature flags.
     *
     * NEXT_PUBLIC_USE_MOCK_AUTH=true   → localStorage auth (demo, no backend needed)
     * NEXT_PUBLIC_USE_MOCK_AUTH=false  → real Express backend auth (default when unset)
     *
     * NEXT_PUBLIC_USE_MOCK_DATA=true   → localStorage data (demo, no backend needed)
     * NEXT_PUBLIC_USE_MOCK_DATA=false  → real Express backend API calls (default when unset)
     *
     * Default is false for both — production deployments without these vars use the real backend.
     * Set both to true in local .env.local to use mock/demo mode without a running backend.
     */
    ```
  - **Impact**: Local dev environments that relied on the old default (no var set = mock mode) must now explicitly add `NEXT_PUBLIC_USE_MOCK_AUTH=true` and `NEXT_PUBLIC_USE_MOCK_DATA=true` to their local `.env.local`
  - _Requirements: missing env var no longer silently enables mock mode in production_

- [ ] 8. Gate the demo account switcher in AccountDropdown (HIGH)
  - File: `frontend/src/features/tenant/layout/account-dropdown.tsx`
  - The "Switch Role / Demo Host" section renders for all authenticated users, including real production users. After Task 5 it still shows the System Admin entry with a hardcoded password.
  - Add import at the top of the file (with other internal imports):
    ```typescript
    import { USE_MOCK_AUTH } from '@/lib/config';
    ```
  - In the `DropdownContent` component, wrap the section label div and the `SWITCH_ACCOUNTS.map(...)` div together in a single conditional:
    ```tsx
    {USE_MOCK_AUTH && (
      <>
        {/* Section label */}
        <div className="px-4 pt-1.5 pb-1">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Switch Role / Demo Host
          </p>
        </div>

        {/* Demo accounts */}
        <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
          {SWITCH_ACCOUNTS.map((acc) => { ... })}
        </div>
      </>
    )}
    ```
  - The divider (`<div className="h-px ...">`) and the Logout button remain outside the conditional — always visible
  - After Task 7, `USE_MOCK_AUTH` defaults to `false`, so this section is hidden by default in production with no env var set
  - _Requirements: real production users never see the demo switcher or hardcoded credentials; demo switcher remains fully functional in mock/dev mode_

- [ ] 9. Create `.env.example` files for both packages (MEDIUM)
  - Create `backend/.env.example` with all required and optional env var keys and safe placeholder values (never real secrets)
  - Create `frontend/.env.example` with all required frontend env var keys and safe placeholder values
  - Both files go in the respective package roots

  **`backend/.env.example`** content:
  ```
  # ── Database ──────────────────────────────────────────────────────
  DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?pgbouncer=true"
  DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

  # ── Authentication ─────────────────────────────────────────────────
  # Generate a strong random secret: openssl rand -base64 32
  JWT_SECRET="replace-with-a-strong-random-secret-minimum-32-chars"

  # ── Application ────────────────────────────────────────────────────
  NODE_ENV="production"
  PORT=4000
  ALLOWED_ORIGINS="https://your-frontend-domain.vercel.app"
  APP_URL="https://your-frontend-domain.vercel.app"

  # ── System Admin Seed ──────────────────────────────────────────────
  SYSTEM_ADMIN_EMAIL="your-admin@example.com"
  # REQUIRED in production — use a strong password, never "admin123"
  SYSTEM_ADMIN_PASSWORD="replace-with-strong-password"

  # ── Dev OTP Bypass (NEVER set in production) ──────────────────────
  # DEV_OTP_BYPASS=false
  # DEV_SEED_EMAILS=""

  # ── Email / SMTP ───────────────────────────────────────────────────
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-email@gmail.com
  SMTP_PASS=your-gmail-app-password
  SMTP_FROM="LeadCRM <your-email@gmail.com>"
  PASSWORD_RESET_TTL_MINUTES=60

  # ── Resend (email OTP) ─────────────────────────────────────────────
  RESEND_API_KEY=re_your_resend_api_key
  RESEND_FROM="LeadCRM <noreply@yourdomain.com>"

  # ── Google OAuth (Sign-In with Google) ─────────────────────────────
  GOOGLE_OAUTH_CLIENT_ID="your-google-oauth-client-id.apps.googleusercontent.com"
  GOOGLE_OAUTH_CLIENT_SECRET="GOCSPX-your-google-oauth-client-secret"

  # ── Gmail Integration ──────────────────────────────────────────────
  GMAIL_CLIENT_ID="your-gmail-integration-client-id.apps.googleusercontent.com"
  GMAIL_CLIENT_SECRET="GOCSPX-your-gmail-integration-client-secret"
  GMAIL_REDIRECT_URI="https://your-backend-domain.onrender.com/api/v1/integrations/gmail/callback"

  # ── Stripe ─────────────────────────────────────────────────────────
  # Use sk_live_... keys in production. Use sk_test_... for staging.
  STRIPE_SECRET_KEY="sk_live_your_stripe_secret_key"
  STRIPE_PUBLISHABLE_KEY="pk_live_your_stripe_publishable_key"
  STRIPE_WEBHOOK_SECRET="whsec_your_stripe_webhook_signing_secret"

  # ── Demo Tenant Generation (skip in production) ────────────────────
  SKIP_DEMO_TENANTS=true
  ```

  **`frontend/.env.example`** content:
  ```
  # ── API Connection ─────────────────────────────────────────────────
  NEXT_PUBLIC_API_URL=https://your-backend-domain.onrender.com/api/v1

  # ── Mode Flags ─────────────────────────────────────────────────────
  # Keep both false in production — true only for local mock/demo mode
  NEXT_PUBLIC_USE_MOCK_DATA=false
  NEXT_PUBLIC_USE_MOCK_AUTH=false

  # ── NextAuth ───────────────────────────────────────────────────────
  # Generate: openssl rand -base64 32
  NEXTAUTH_SECRET=replace-with-a-strong-random-secret
  NEXTAUTH_URL=https://your-frontend-domain.vercel.app

  # ── Google OAuth ───────────────────────────────────────────────────
  GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=GOCSPX-your-google-oauth-client-secret

  # ── Stripe (frontend) ──────────────────────────────────────────────
  STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
  STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
  ```

  - Do NOT copy any real values from `backend/.env` or `frontend/.env.local` — placeholders only
  - Both files should be committed to git (they contain no secrets)
  - _Requirements: team has a complete reference for production deployment env vars; no real secrets in version control_
