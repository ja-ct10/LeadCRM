# Login protection: sixth submission and five-minute cooldown

Implementation and evidence recorded on 2026-10-12 (Asia/Manila). Production
acceptance is tracked separately below; local evidence is not a deployment claim.

## Existing authentication audit

`auth.service.ts` already supported normalized, case-insensitive email lookup,
legacy tenant-scoped duplicate emails, bcrypt passwords, employee restrictions,
active-account/workspace checks and a transactional session re-read. It had no
durable consecutive-failure state. Login shared a process-local limiter with
password changes: ten unsuccessful requests per IP in a 15-minute production
window. That window could outlast the requested account cooldown.

AuthContext propagates structured API errors. AuthGuard owns navigation after
successful login and session restoration; neither gains manual Login redirects.
Recovery retains hashed single-use tokens, separate abuse limits, session
revocation and its existing approved unknown-email disclosure. Recovery/reset
never clears this login state.

## Exact enforcement and persistence

The canonical identity is HMAC-SHA-256 of `email.trim().toLowerCase()`, with a
domain-separated key. It includes unknown emails and spans legacy duplicates
across tenants. Passwords, raw addresses, hashes and tokens never enter the key.

`LoginAttemptState` stores the identity key, consecutive failure count,
`lastFailedAt`, `lockedUntil`, one repeated-denial audit marker and `updatedAt`.
The additive `20261127000000_login_attempt_lockout` migration creates this table
and `LoginIpRateLimit`; it changes no existing users, sessions or CRM history.
The reviewed migration is included in the existing deployment allowlist without
relaxing retirement/checksum/failed-migration guards.

Every login uses a READ COMMITTED transaction, inserts the identity if needed,
and takes `SELECT ... FOR UPDATE`. Database time is sampled after acquiring the
lock. The identity lock remains held through verification and session creation:

1. An active lockout rejects immediately without changing its expiry.
2. An expired lockout clears the counter before processing another submission.
3. A previously stored count of five sets expiry to database time + **300,000 ms**
   and rejects before user lookup, password validation, bcrypt or session creation.
4. Otherwise, a well-formed incorrect credential submission increments the count
   and returns **401 `Invalid email or password.`**. The fifth remains ordinary.
5. Normal successful authentication resets the counter in the session transaction.

Invalid request bodies before the threshold do not count as credential failures;
once five failures exist, even an empty/malformed password on the sixth submission
activates cooldown. Email identity must still be valid and normalized.

Failure/lockout outcomes commit before being thrown to HTTP middleware. A database
failure fails closed. User/workspace row locks preserve the existing protection
against concurrent password changes, deactivation and workspace suspension.
Conflicting transactions use the existing bounded retry helper. There is no
failure inactivity expiration and no public security-reset endpoint.

## API, IP protection and privacy

Lockout returns 429 `AUTH_LOGIN_LOCKED`, the required message, UTC `retryAt`,
authoritative `serverNow`, `Retry-After` and `Cache-Control: no-store`. No login
JWT, authentication cookie or Session is created on denial.

Login now has a separate **shared PostgreSQL budget of 60 requests per IP per
minute**, covering login and proof restoration, including malformed requests.
Its duration cannot preserve the former extra ten-minute block. Password changes
retain their old budget; recovery retains independent address/IP limits; the
general API limiter remains in place. IPv4-mapped addresses normalize to IPv4;
IPv6 addresses share a /64 budget. Express resolves the IP using the existing
explicit trusted-proxy chain, rather than trusting the first forwarded address.
Hosting must continue restricting trusted ingress and direct backend-port access.

Unknown identities receive the same five failures and cooldown. A dummy cost-12
bcrypt comparison removes the previous fast missing-account return. Existing
duplicate candidate/hash-cost timing differences and recovery's approved
`ACCOUNT_NOT_FOUND` disclosure are not claims of complete enumeration resistance.
The new lockout checks occur before account lookup and reveal no account existence.

`LOGIN_IDENTITY_SECRET` is an optional dedicated stable key of at least 32 characters; otherwise the existing
stable `JWT_SECRET` is used. All replicas must use the same key. Keep it unchanged
across releases. Key rotation requires an explicitly reviewed security recovery;
changing it would change identity digests and invalidate UI proofs.

## Modal, timer and browser restoration

The existing Dialog implements the approved lock icon, exact title/message,
large MM:SS countdown, supporting text and Close button. It uses the saved
appearance preference for light/dark styling while retaining the public Login
layout. Existing focus trapping, Escape handling, scroll containment and focus
restoration remain in use. Timer semantics are readable by assistive technology;
polite announcements are bounded instead of announcing every second for five minutes.

The countdown uses the difference between server expiry and server time, then
the browser clock for elapsed time. It recalculates on focus/visibility and every
second; cleanup removes timers/listeners. Closing or reopening does not restart
it. Expiration clears UI state without submitting credentials or signing in.

A denied login issues **only an opaque signed HttpOnly UI marker**, expiring at
the original cooldown deadline. This is not a JWT or authentication cookie. The
same-origin proxy forwards that marker without extending its life. Restoration
requires this proof and validates the authoritative database state through
`POST /auth/login-lockout`; there is no unrestricted email-status endpoint. An
old proof cannot inspect a later cooldown cycle. No email/password/countdown is
persisted in localStorage or sessionStorage by login protection.

The currently locked identity disables Login and password entry. A ref blocks
double submits. Password text clears on lockout. Login errors reuse one owned
toast, which is dismissed when the modal appears. Forgot Password stays accessible.
Deleting cookies removes UI restoration evidence but cannot bypass database
enforcement. Other browsers/devices/processes consult the same identity state.

## Security events

Structured `[LoginSecurity]` events record credential failures, sixth activation,
the first subsequent denial in each cooldown, expiry and success after failures.
They contain only event names, keyed digests and counts. They are emitted after
commit. Successful failure reset also uses the existing tenant-scoped AuditLog.
Unknown pre-authentication events follow the existing structured security-log
channel because AuditLog requires a real tenant/user. HTTP access logs remain;
duplicate operational lockout-error logging is suppressed. Log bodies, credentials,
Prisma payloads and tokens are excluded from this authentication error path.

## Verification evidence

- **20 lockout acceptance tests passed** on real PostgreSQL 17.6, migrated disposable databases and ten concurrent Prisma
  connections: threshold, correct sixth password, fixed expiry, repeated denials,
  proof validation, restart/new-client persistence, resets, unknown/case/whitespace
  handling, twenty parallel requests, an overlapping fifth failure/correct sixth
  request, duplicates, role login, recovery/reset independence and shared IP budgets.
- A separate compiled-stack run used two actual backend processes. It recorded
  an exact 300,000-ms expiry, blocked the correct sixth password and a second
  replica, restarted a backend process, then waited the actual five minutes.
  Correct login succeeded after expiry and the next wrong password returned 401.
- Frontend focused acceptance: **69 passed across seven suites**, including real
  Dialog behavior, countdown/skew/sleep/refresh, double submits, owned-toast
  dismissal, recovery, transport/proof cookies, AuthContext and AuthGuard regression.
- Migration deployment safety: **9 passed**. All workspace builds passed; final
  frontend build generated **180 pages**. Final backend build/TypeScript check and
  frontend TypeScript check passed after disposable processes released the Prisma DLL.
- Browser used the production frontend build with isolated PostgreSQL/backend
  processes. The fixture supplies child-only DNS/certificate trust and a loopback
  origin gateway; this is local UI evidence, not a production ingress claim.
- Browser verified five normal errors/no modal, correct sixth rejection with
  **05:00**, one modal/no credential toast, refresh restoration and keyboard focus
  wrapping. All eight widths passed in **light and dark**: 320×568, 375×667,
  390×844, 430×932, 768×1024, 1024×768, 1440×900 and 1920×1080. Checks confirmed
  no horizontal overflow, modal/Close within the viewport and no text overlap.
- Screenshots and browser JSON are outside the repository under the current
  Codex visualization folder, `login-lockout/` (`light-*`, `dark-*`, fifth failure,
  sixth activation, backup and migration audit).

Two existing avatar unit tests still expected retired Supabase uploads. Their
storage boundary fixture was aligned with the existing private mounted-storage
API; no avatar product code changed. The expanded authentication run then passed
**208 tests**, with **18 existing guarded tests skipped**, including the additional
malformed-password sixth-gate case. Browser authentication reached `/dashboard`
after actual expiry and restored that session on refresh.

## Production status and remaining acceptance

Before this release, public backend health reported
`dc71889dcea7e7adebcf7f8b84ce8849cfc05684`. A read-only transaction in the private
Coolify database reported **115 migrations**, latest
`20261126000000_notification_policy`, **zero failed migrations**, and no
`LoginAttemptState` table. Coolify reported a fresh successful **16.95-MB** local
backup, available at:

`/data/coolify/backups/databases/root-team-0/leadcrm-postgres-prod-yvwx3pvmetfgrhrtlckck2wn/pg-dump-leadcrm-1791779204-vscwvegkcugk57cww9kgfflq.dmp`

Backup availability is control-plane evidence; no restore drill was performed.
No customer identity was subjected to repeated failed-login testing.

Release/deployed acceptance will be appended here after final checks. Do not call
this production-ready solely from source publication or a healthy container.
Required live evidence includes matching frontend/backend SHA, successful additive
migration, a dedicated identity's exact cooldown/modal/refresh and post-expiry
authentication, trusted-ingress behavior, and sanitized runtime/database logs.

Operational risks: account lockout can be deliberately triggered by a guesser,
as inherent in the approved policy; stored failed identities have no inactivity
expiry, so their storage needs monitoring; the shared key must remain stable;
lock contention/timeout must fail closed; actual provider delivery and real-device
screen-reader behavior require their own controlled acceptance.

## Changed files

- Backend schema/migration and guarded deployment-plan test/script.
- Auth service/controller/DTO/transaction and new `login-attempt.service.ts`.
- Auth routes, error middleware/AppError, rate-limit module and new shared-IP limiter.
- Auth mock fixture, login/lockout integration tests and private-storage unit fixture.
- Local native-database/process/browser acceptance scripts only; not production startup.
- Shared authentication/API contracts and generated authentication JavaScript.
- Login page, lockout hook/Dialog, auth API/client and same-origin cookie proxy.
- Frontend lockout/client/proxy tests and authentication/API/deployment documentation.

Unrelated Dashboard implementation, its verification scripts and spacing report
were pre-existing workspace changes and are excluded from this release.
