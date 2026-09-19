# Authentication and onboarding

The [implementation plan and source audit](plans/auth-onboarding-lifecycle.md)
records the original failures, affected files, rollout order, and acceptance matrix.
The persistent source of truth is PostgreSQL through Prisma.

## Registration and sign-in

Both self-service registration methods create a **Guest** owner of a new
SANDBOX workspace with no paid plan, step 0, and no completion timestamp.
Ownership is `Tenant.ownerUserId`; it does not grant Client Admin.
Completing onboarding never promotes the Guest. Existing subscription promotion
and RBAC remain separate.

Manual registration collects first/last name, email, password, and accepted terms.
The backend normalizes email, creates a PENDING user, provisions the workspace,
roles, Guest assignment, default pipeline and sandbox sample data in one
serializable transaction, and creates verification credentials. Email delivery
happens after commit; a failed send leaves a recoverable account and returns
`emailSent: false`. The user verifies using the one-time link or six-digit code.
Verification activates only an eligible pending account and establishes a session.
A returning unverified password user is directed back to verification.

Google uses NextAuth only for the provider handshake. Its server callback sends
the Google ID token to the backend. The backend verifies signature, expiry,
issuer, audience, subject and verified email using the installed Google library.
An existing provider subject returns its existing user and workspace. New
identities use the same Guest provisioner with ACTIVE/verified status.
Ambiguous email matches require recovery. Pending manual registrations must
verify first; existing third-party email accounts cannot be silently linked
based on a Google email claim alone.

An accepted invitation remains a separate association with the invitation's
existing tenant and assigned role. It neither provisions a founder workspace nor
adds a team invitation step to onboarding.

## Onboarding state and access

| Stored step | Completion timestamp | Screen |
| --- | --- | --- |
| 0 | null | LeadCRM introduction |
| 1 | null | Basic CRM workflow |
| 2 | null | Company Setup |
| 3 | present | Dashboard |
| Any contradictory combination | inconsistent | Recovery/support |

The two information pages introduce LeadCRM, customer records, sales pipelines,
and follow-up work. Company Setup is last: company name, industry, size, optional
website, and timezone. There is no Invite Team or required payment step.

Progress saves an adjacent transition using `expectedStep`. A stale request
returns 409; the client reloads the server snapshot. Only the active, verified
workspace owner can change progress or company details. Final submission requires
step 2 and atomically saves company details, completion timestamp, and audit log.
A repeated completion preserves the original result. Welcome mail is a best-effort
post-commit send; delivery is not a condition of completion.

`shared/src/constants/onboarding.ts` defines state interpretation.
`frontend/src/shared/auth/auth-routing.ts` defines route decisions.
AuthGuard applies them without rendering protected children during restoration,
failure, or a pending redirect. AuthContext applies the canonical server response;
mutations do not trigger a redundant status or session fetch. Tenant names,
password presence, localStorage, and NextAuth flags cannot complete onboarding.

Refresh and login restore the database step through `/auth/me` or the login
response. Incomplete owners resume setup, completed users reach Dashboard, and
members of incomplete workspaces see an owner-required recovery screen.
Only the exact System Admin role uses the admin portal bypass.
DataContext waits for workspace readiness before fetching CRM data.

Backend authentication checks signed identity, persisted session, and current
database user/role. CRM route groups additionally require verified email and
completed onboarding, then apply existing subscription, tenant and RBAC rules.
Account recovery, session operations, own-permission lookup, and billing APIs
remain available as appropriate. A database failure is a server error, not a
false unauthenticated response.

## Session and proxy responsibilities

The browser authenticates with the `leadcrm_token` HttpOnly cookie, Path=/,
SameSite=Lax, Secure in production. Sessions are revocable and stored by token
hash. Password login, OTP verification, magic links, and Google converge on the
same LeadCRM session. Canonical auth responses contain user state, not a browser
bearer token. The NextAuth bridge consumes its backend token server-side and
does not put it in the NextAuth JWT/session.

Keep `frontend/app/api/proxy/[...path]/route.ts`: it forwards browser requests to
the separately hosted backend, keeping cookies on the frontend origin.
All browser API-client requests use this transport, including local development.
Cookie forwarding preserves deletion and expiry semantics and removes a backend
Domain attribute. This proxy makes no onboarding decisions.

The removed `frontend/middleware.ts` was a second redirect authority based on
NextAuth state. It forced new Google users into company setup and could override
the first introduction. Common AuthGuard routing and backend authorization replace
that responsibility; there is no replacement redirect middleware.

Verification mail points to the frontend's `/api/verify-email?token=...`.
That route consumes the one-time credential through the backend JSON endpoint,
forwards its cookie, and redirects to root for normal state resolution.
Legacy backend-host links first hand off the unconsumed credential.
Responses use no-store/no-referrer; a session JWT never goes in a redirect URL.

Logout revokes the backend session, expires the cookie, signs out NextAuth, and
clears frontend identity, permissions and cached data. Failures are reported.
Onboarding progress remains in the database.

## Code ownership

| Responsibility | Location |
| --- | --- |
| Shared response/validation | `shared/src/contracts/auth.contract.ts`, `validation/auth.schema.ts` |
| Workspace provisioning | `backend/src/core/auth/provision-workspace.service.ts` |
| Manual signup / Google identity | `registration.service.ts`, `google-identity.service.ts`, `oauth.service.ts` |
| Verification / onboarding | `verification.service.ts`, `onboarding.service.ts` |
| Session construction / snapshot | `auth-session.ts`, `auth-user.ts` |
| Browser state | `frontend/src/store/AuthContext.tsx` |
| Route policy | `frontend/src/shared/auth/auth-routing.ts` |
| Information and company UI | `frontend/src/features/tenant/onboarding` |
| Cookie forwarding | `frontend/src/lib/auth/cookies.ts` |

The tracked CommonJS siblings under shared/src are generated from their TypeScript
sources; keep emitted artifacts synchronized rather than implementing a second rule.

## Configuration and rollout

- Frontend: `API_URL` is the backend base including /api/v1; configure
  `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.
- Backend: configure the same `GOOGLE_CLIENT_ID`, existing JWT/database/email
  settings, and `APP_URL` as the frontend origin.
- Set `NEXT_PUBLIC_USE_MOCK_AUTH=false` and
  `NEXT_PUBLIC_USE_MOCK_DATA=false` for live acceptance tests.
- Apply `20260917000000_tenant_company_website` before deploying code that selects
  the new optional Tenant.website column. No new onboarding tables are required.
- Regenerate Prisma Client, then deploy backend and frontend together.
- Review legacy onboarding rows before strict state routing reaches them.
  Do not infer completion from a company name or bulk-demote Client Admins.

## Reviewed legacy repair

`npm --prefix backend run fix:onboarding -- --dry-run` inventories persisted
state without modifying it. The tool was prepared but has not been run against
a database during this implementation.

Apply only a reviewed JSON manifest:
`npm --prefix backend run fix:onboarding -- --apply reviewed-manifest.json`.
Each item in `changes` needs tenantId, expectedUpdatedAt, expectedOwnerUserId
(nullable), expectedStep, expectedCompletedAt (nullable), resumeStep (0 or 2),
and an explanatory reason of at least 10 characters.

Optional controls are `assignOwnerUserId` (only when ownership is missing),
`repairDefaults`, and `demoteGoogleFounder`. Demotion additionally requires
an unpaid SANDBOX Google founder with no password and no subscription history.
The manifest must be reviewed against actual account/promotion history;
eligibility checks alone do not prove the historical assignment was wrong.

The repair checks expected values in a serializable transaction, updates role
and assignment together when needed, revokes demoted sessions, and records an
audit entry. Existing sample/customer records are not reseeded. Each tenant
commits separately; if a later item fails, reinventory before retrying.
Back up affected rows before any apply operation.

## Verification limits

Automated tests import the real lifecycle services, route handlers and React
components, with database, Google and mail boundaries mocked. They do not prove
PostgreSQL rollback/concurrency, real Google configuration, SMTP delivery, or
separate-origin browser cookie behavior. Run those checks against an isolated
test environment before release. See the plan for current command results and
remaining release checks.
