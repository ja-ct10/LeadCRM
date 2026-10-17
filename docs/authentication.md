# Authentication and onboarding

LeadCRM is an internally managed CRM for Camxian Technologies. PostgreSQL is the source of truth for account status, roles, password-change requirements, and onboarding. Existing bcrypt hashing, HttpOnly cookies, JWT verification, database sessions, tenant scoping, and RBAC remain in use.

See [security cleanup](security-cleanup-mfa.md) for password behavior and migration history.

Login allows five consecutive failed credential submissions; the **sixth**
submission activates a durable five-minute account cooldown before checking its
password. Cooldown expiry resets consecutive failures but preserves the sequence
of protection cycles. Cycles one and two receive the existing cooldown; cycle
three permanently security-locks the account. Genuine successful authentication
resets both counters. Client Admin with `users.activate` and `users.view` can
unlock through Team Management without activating an inactive employee. Recovery
and password reset do not clear the security lock. See [current implementation and verification](security-export-products-verification.md)
and [original login lockout implementation](login-lockout-verification.md)
for concurrency, shared IP limits, browser restoration and deployment requirements.

## Supported flows

- All new users: sign in with email/password → change temporary password when required → informational LeadCRM onboarding → dashboard with existing role permissions.
- Returning users who have completed setup: sign in → dashboard, or change their password first when it has expired.
- Existing users with `mustChangePassword=false` at migration time keep their established access; their passwords and roles are unchanged.

Tenant portal accounts require a valid registered staff identity. Exact, case-insensitive @camxian.com accounts retain their existing access policy. Other addresses require persisted Client Admin approval for that same user, tenant and exact normalized email. The backend checks this policy at password login and on authenticated requests, including existing sessions. Inactive accounts and unavailable workspaces are denied access.

For local development and automated testing only, the backend can permit exact Gmail addresses from the server-side `LEADCRM_TEST_EMAIL_ALLOWLIST` when `LEADCRM_TEST_AUTH_ENABLED=true`. This exception is active only when `NODE_ENV` is `development` or `test`; production always ignores these test settings. Keep allowlists out of frontend variables. Users still need real persisted User records, normal passwords/sessions, roles, and backend permissions. Turning the applicable flag off rejects Gmail accounts at login and on existing sessions.

## Client Admin approval of production staff

Client Admin can provision a personal Gmail or Workspace address through Team Management with an existing active custom role. User creation, exact-email approval (`user.staff_approved`), role/group assignments and audit records commit together. Welcome submission follows the commit using the existing transport. New addresses require no environment-variable edits. Non-admin provisioners retain the company-domain policy even when their role allows user creation.

Historical external staff without approval evidence remain denied until Client Admin selects **Approve registered email** in their User Details. The corresponding `POST /administration/users/:id/approve-email` requires an active ready Client Admin and `users.edit`, verifies the target in the same tenant, and records approval once. It does not create an account, reset credentials, assign permissions or bypass onboarding. Email matching remains exact after trimming/lowercasing; Gmail dot/plus aliases are not interchangeable.

Existing `user.production_provisioned` or `user.production_credentials_reissued` audit evidence from the deliberately invoked CLI remains accepted for its exact user/tenant/email. The legacy `LEADCRM_PRODUCTION_AUTH_ENABLED` and `LEADCRM_PRODUCTION_EMAIL_ALLOWLIST` flags now gate only that CLI, not application login. Disabling them does not revoke persisted approvals; deactivate a staff account through the existing guarded workflow to revoke access.

Gmail OAuth remains separate from password login: an eligible, ready staff member with CRM View permission must consent to their own registered Google mailbox. Public signup remains disabled. A Google account without Gmail cannot connect through this integration.

## Internal provisioning and passwords

Client Admin manages staff accounts through Team Management. There is no separate operator provisioning endpoint.

Team Management generates `firstname.lastnameNN`: names are normalized to lowercase ASCII letters/digits, unsupported characters/spaces are removed, and `crypto.randomInt(0, 100)` supplies two zero-padded digits. Empty normalized names use `user`/`account`. Each name part is limited to 34 characters, keeping the result within bcrypt's 72-byte limit. No shared `password123` credential is assigned by this flow.

The existing bcrypt helper hashes the credential. User creation, selected custom-role assignment, and the audit entry commit together. Only the hash is stored. Plaintext exists transiently for the existing branded `sendMail()` welcome email, which includes the recipient's own credential and `${APP_URL}/login`; it is never returned by the API, logged, or stored in audit records. The subject is **Welcome to LeadCRM**. `setupEmailSent=true` means the provider accepted submission; it does not confirm inbox delivery. An unsubmitted, rejected, or failed request produces an account-created warning. Retry account creation does not duplicate the user; administrators can use the existing Send Password Reset action for recovery.

User.mustChangePassword is persisted. The canonical auth response also requires a change when server time is at least 90 × 24 hours after User.passwordChangedAt. The rule lives in `backend/src/core/auth/password-expiration.ts`; it is recalculated on login, session restoration, and every protected request. Correct expired credentials still authenticate. Until changed, authenticated tenant users can read /auth/me, change their password, or log out. Other protected APIs, including onboarding completion and preference endpoints, reject requests with 403 PASSWORD_CHANGE_REQUIRED. The existing browser auth routing sends them to /change-password, including when an HTTP request or an existing authorization stream detects expiration.

Successful password change or token-based reset writes the new hash, clears the stored requirement, and sets passwordChangedAt to server time. This starts a new 90-day period without clearing onboarding. Requesting a reset email does not change the timestamp. Null timestamps do not themselves force expiration; deployment must first audit established legacy password users and apply the conditional backfill below.

### Legacy timestamp rollout

Before releasing expiration enforcement, identify the deployment database and audit it using `backend/scripts/backfill-password-timestamps.mjs`. It never loads application `.env` files and defaults to a read-only transaction. Set `PASSWORD_EXPIRATION_DATABASE_URL` securely for the explicit target, then run:

```powershell
node backend/scripts/backfill-password-timestamps.mjs --target=host:5432/database
```

Replace the target with the exact host, port and database from that URL. Only if the audit finds existing users with a password hash, null passwordChangedAt, and mustChangePassword=false, stop old writers and obtain immediately-before-cutover approval for the exact environment and count. Run the same command with `--apply --expected-count=N`, using the verified eligible count. The transaction refuses count drift, initializes only those rows at one UTC database timestamp, verifies preservation, and rolls back on a mismatch. Existing timestamps, temporary/passwordless users, credentials and onboarding remain intact. Repeating the read-only audit must show zero eligible rows; rerunning the backfill with expected count zero changes nothing. No schema migration is required.

POST /auth/change-password accepts `{ currentPassword, password }` from the authenticated session. It verifies the current credential first, returning `CURRENT_PASSWORD_INCORRECT` with “Current password is incorrect.” on failure. The issued temporary credential is accepted as Old Password. Reusing it as the new password still returns `PASSWORD_REUSE`: “You cannot reuse your temporary password. Please choose a new password.” Different passwords must meet the shared strength policy. It writes the new hash, clears the flag, revokes other sessions and account-bound reset tokens, and records an audit event in one serializable transaction. The current database session stays valid. The frontend reuses the profile password form, shows field errors and “Password updated successfully.”, and applies the canonical user response to advance to onboarding. Password recovery uses its separate token contract and the same new-password strength policy; it does not require Old Password or complete onboarding.

Sessions additionally expire after thirty minutes without activity. Validation checks the existing `lastActiveAt` before renewing it, returning `401 SESSION_IDLE_EXPIRED` and revoking idle sessions. Browser interactions use `/auth/activity` with leading/trailing updates coalesced to once per minute; passive polling, session restoration and SSE do not renew activity. The frontend shares activity/logout across tabs and displays “Your session expired due to inactivity. Please log in again.” Absolute expiration and manual logout retain their existing behavior.

The existing notification outbox schedules a mandatory, self-only `password_expiring_soon` reminder at `passwordChangedAt + 89 days`. The worker checks the current cycle and suppresses stale events and events arriving at day 90. Delivery is deduplicated by the existing ledger, even after notification deletion. The link opens the Settings password dialog. Password changes and resets start the next cycle; null timestamps remain null. No email or SMS reminder is sent.

User update and bulk-update payloads have an explicit allowlist. They cannot inject mustChangePassword, passwordHash, or tenantId. Primary-role changes synchronize User.role and UserRole in the same transaction; custom permission definitions remain unchanged.

## Informational onboarding

The existing onboarding status/completion routes and canonical auth response now use `User.onboardingCompletedAt`. Migration `20261104000000_user_first_login_onboarding` adds that nullable timestamp and backfills established users with `mustChangePassword=false`. Legacy Tenant fields are retained for compatibility; another user's or workspace's completion cannot skip a new user's tour.

The Login-inspired layout has a blue branding/progress panel and an informational content panel, stacked on small screens. Eight steps cover Welcome, Leads & Contacts, Accounts & Deals, Tasks & Activities, Campaigns & Email, Workflows, Forms & Products, and Notifications & Search. Next advances the local reading step. Skip and Finish both call the existing completion endpoint. Completion is persisted per user and audited once; the server response sends the user to Dashboard. Future logins skip the completed tour. No permissions are granted by completing it.

All protected module APIs and mailbox operations enforce password setup first, then onboarding, then the normal RBAC checks. Client route guards mirror that order. A localStorage flag or a manually entered URL cannot complete either server requirement.

## Development test-user provisioning

Use a confirmed development/test backend and database for the development mode, with both test-auth environment variables configured server-side. A production backend ignores this development exception even when the flag is enabled. The frontend URL alone does not establish the backend environment. Keep production in production mode and use Client Admin staff approval.

After applying the migration to the confirmed development database, run the deliberate CLI for each account (replace `<development-tenant-id>` with the existing test workspace ID):

```powershell
npm --prefix backend run db:provision-test-user -- --tenant-id <development-tenant-id> --email tironjulieann10@gmail.com --first-name "Julie Ann" --last-name Tiron
npm --prefix backend run db:provision-test-user -- --tenant-id <development-tenant-id> --email reymarkjpanes@gmail.com --first-name Reymark --last-name Panes
```

The CLI requires explicit development/test mode, the enabled flag, an exact allowlisted Gmail address, and an existing active Client Admin role in the selected workspace. It normalizes email comparison, rejects ambiguous/foreign-workspace matches, and preserves existing accounts by default. `--reissue` is a deliberate credential reset: generates a new temporary password, resets password/onboarding requirements, revokes sessions/reset tokens, and emails the new credential. No stored plaintext is recovered. A failed submission can be retried with `--reissue`; the new credential supersedes the previous one.

Set `APP_URL=https://lead-crm-frontend-pi.vercel.app` for the requested welcome link only when that frontend points to the confirmed test backend. If `BREVO_SANDBOX_EMAILS` is configured, include both recipient addresses there. The CLI prints only email, status, and the provider-submission boolean. Set `LEADCRM_TEST_AUTH_ENABLED=false` to immediately reject both Gmail accounts at login and on existing sessions.

## Recovery and account provisioning

Public password recovery uses the owner's explicitly approved account-existence disclosure policy: an unknown normalized email returns HTTP 404 with `ACCOUNT_NOT_FOUND` and “No account exists with this email address.” This is an intentional enumeration tradeoff, approved on October 10, 2026. Ineligible or ambiguous existing identities retain neutral responses; public callers cannot select a tenant. See the [recovery audit, approval, test results and deployment requirements](password-recovery-verification.md).

Recovery shares login's trimmed, case-insensitive identity lookup and the current employee/workspace/account access policies. Issued tokens are stored as SHA-256 hashes. Resend uses the same endpoint, rate limits and durable submission state; an uncertain provider submission is retained without automatic retry until its original expiry. The confirmation page displays the backend lifetime and acknowledges a recovery request without claiming inbox delivery.

Deploy migration `20261120000000_password_recovery_security` with the matching backend/frontend release. Stop old backend processes before hashing existing token rows; old binaries cannot read the new storage format. The migration preserves token identity, account binding and expiration, and the normal guarded deployment path continues to defer unrelated column retirements.

Tenant user accounts are provisioned by administrators through Team Management. The tenant-invitation flow and its token-based acceptance endpoint have been retired. Provisioned passwords are temporary when required, and users can establish their password through authenticated password change or password recovery.

Public signup, Google account sign-in, OTP, email-verification sessions, company setup, and old onboarding progress endpoints are disabled. Retired authentication bridge routes are unavailable. Gmail OAuth remains a separate CRM email integration and is not affected by the LeadCRM test-account exception: each tester must connect their mailbox through Google's real OAuth authorization and grant the requested Gmail scopes.

An **External / Testing** Google app still requires selected controlled Google test users until production publishing and applicable verification are completed. That is an external launch blocker, not the production onboarding design. An **Internal** app excludes personal Gmail accounts outside its Workspace organization. See Google's [OAuth app state and access rules](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) and [consent screen setup](https://developers.google.com/workspace/guides/configure-oauth-consent).

## Deployment

Apply forward migrations with `npm --prefix backend run db:deploy`. See [retirement migration and validation](retired-features-cleanup.md). Existing passwordless accounts use password recovery or administrator provisioning.

The final role migration disables historical Guest accounts, revokes their sessions and any legacy pending invitations, and archives their role definitions without deleting identities, CRM data, assignments, or permissions. Only Client Admin is seeded as a predefined tenant role. There is no automatic User role: an administrator must select an existing custom role. Existing User definitions become editable custom roles with unchanged permissions. See [migration and verification](plans/final-role-model.md).

See [implementation and retirement inventory](plans/internal-camxian-crm.md) for affected files, preserved dependencies, and verification.
