> Historical project/design record, not current implementation guidance. Retired SaaS access and billing descriptions below must not be implemented. Current authority: `docs/authentication.md`, `docs/crm-environments.md`, and `docs/internal-crm-cleanup.md`.

> Historical implementation record. The final role model is documented in [authentication](../authentication.md) and [role migration](../plans/final-role-model.md).

# LeadCRM authentication and onboarding implementation plan

Status: Implemented in the working tree; deployment and live acceptance checks remain pending.
Updated: 2026-09-18.
Prepared: 2026-09-17.
Scope: Manual registration, Google authentication, verification, workspace
provisioning, onboarding, company setup, session recovery, and access enforcement.

## Implementation record

The phases below now distinguish completed source changes from release work.
Checked implementation items describe the code and automated coverage, not a
claim that production data was migrated or real OAuth/email delivery was tested.

- Shared auth/state/validation contracts, Guest provisioning, verification,
  owner-only onboarding, route consolidation, and feature UI are implemented.
- Manual and Google founders remain Guest after Company Setup.
- Removed the conflicting NextAuth redirect middleware; retained the API proxy
  as a same-origin cookie transport.
- Replaced blanket data repair with inventory-first, reviewed-manifest tooling.
  No database repair or migration has been executed.
- Required additive migration: Tenant.website. Prisma schema validation passed.
  Prisma engine generation encountered a Windows DLL file lock (EPERM), including
  an elevated retry; rerun generation after the process holding the engine exits.
- Backend TypeScript compilation passed; backend plus the normally excluded
  repair script also passed an explicit type check.
- Workspace lint (TypeScript checks in all three workspaces) passed.
- Focused backend tests: **93 passed across 9 files**.
- Focused frontend tests: **133 passed across 16 files**.
- Frontend production build passed using the existing configuration with an
  isolated output directory, `frontend/build/onboarding-check`. All 50 pages
  were generated. The first ordinary build collided with the dev server's .next
  manifest; the isolated build required network access for existing Google Fonts.
  The temporary check tsconfig was removed; project build configuration is unchanged.
- Database rollback/concurrency tests and real Google/email/browser smoke tests
  remain release prerequisites. Automated database/Google/mail boundaries are mocked.
- Unrelated cache and module-data changes already present in the workspace were
  preserved. No new package or state framework was added.

See [the maintained lifecycle documentation](../authentication.md) for module
ownership, configuration, API behavior, and the repair procedure.

## 1. Required outcome

Both manual and Google self-service registrations create a **Guest** user who
owns a new SANDBOX tenant. They converge into the same database-backed flow:

```text
Manual account creation -> Email verification --+
                                               |
Google account creation -> Verified identity ---+
                                               v
                                   LeadCRM introduction
                                               v
                                   Basic CRM workflow
                                               v
                                       Company Setup
                                               v
                                           Dashboard
```

Company Setup is the final onboarding step. No team invitations, payment
selection, or subscription activation are part of onboarding. Completing
onboarding does not change Guest to Client Admin. The existing authorized
subscription activation flow remains responsible for that promotion.

Preserve the architecture described in [ARCHITECTURE](../ARCHITECTURE.md) and
[STRUCTURE](../STRUCTURE.md). Reuse Express, Prisma, NextAuth for Google, the
existing API client, AuthContext, Zod, and existing UI primitives.

This plan supersedes conflicting lifecycle requirements in the older
[onboarding redirect spec](../../.kiro/specs/onboarding-redirect-fix/design.md).
In particular, a tenant name never proves onboarding completion, registration
never completes onboarding, and localStorage never authorizes access.
Historical tests that encode those assumptions must be corrected.

## 2. Confirmed causes and implementation coverage

### Audited manual lifecycle

The old register form collected company details first, then account details and
called registerGuestAccount. Registration created a PENDING Guest and named
SANDBOX tenant with step 0/null completion, but role/default provisioning could
fail outside the account transaction. Email OTP/link activation created a session.
Login/root sent users toward Dashboard while AuthGuard treated a company name or
other local/account signals as evidence that setup was finished. That could skip
the wizard even though the database still described an incomplete tenant.
The old wizard ordered company, Invite Team, and tour, with a separate completion
request and competing company forms.

### Audited Google lifecycle

NextAuth exchanged the Google result through a backend bridge whose public token
handling did not verify the Google signature. The OAuth service used a different
provisioning path, created Client Admin founders, and returned provider-specific
completion flags. NextAuth middleware used those flags to force company setup.
The root/page guards used different tenant-name, password and local-state rules.
Returning users could therefore skip the first page, repeat company setup, or
reach Dashboard despite unfinished persistent onboarding.

### Why the first page was overridden

The direct override was middleware's requiresProfileCompletion redirect into
Company Setup before the onboarding page could establish its intended step.
AuthGuard's named-tenant/password/localStorage heuristics and root/login's
automatic Dashboard navigation added competing redirects. The problem was
multiple state/redirect authorities, not App Router filename ordering.
The fix removes those authorities and resolves routes from one canonical
database snapshot. Both information steps share /onboarding, with the displayed
content chosen by the persisted step.

### Findings and original file references

References below use the audited working-tree line numbers; they may move later.
This was a source audit, not a production database or live OAuth verification.

| Finding | Audited location | Planned fix |
| --- | --- | --- |
| Manual signup collects company data before authentication | `frontend/src/features/tenant/pages/modern-register-page.tsx:70,261` | Phase 5: collect account details first; company details only at the final step |
| Named tenants bypass onboarding | `frontend/src/shared/providers/auth-guard.tsx:84` | Phase 4: use explicit database completion and progress |
| Root/login send everyone through Dashboard first | `frontend/app/page.tsx:33`; `frontend/app/login/page.tsx:26` | Phase 4: resolve the actual destination before navigating |
| Middleware sends new Google users straight to company setup | `frontend/middleware.ts:134` | Phase 4: remove this second redirect authority |
| Google users start as Client Admin | `backend/src/core/auth/oauth.service.ts:239` | Phase 2: assign Guest with a matching UserRole |
| Returning Google accounts report profile completion as false unconditionally | `backend/src/core/auth/oauth.service.ts:126` | Phases 1–2: return canonical database state on every authentication |
| Public Google bridge decodes rather than verifies tokens | `backend/src/core/auth/auth.controller.ts:640` | Phase 2: verify Google signature and claims before identity lookup |
| Founder provisioning is duplicated and differs by signup method | `backend/src/core/auth/auth.service.ts:335,469`; `backend/src/core/auth/oauth.service.ts:206` | Phase 2: one transactional provisioning routine |
| Role seeding/junction failures are swallowed after registration commits | `backend/src/core/auth/auth.service.ts:430,556` | Phase 2: make required provisioning transactional |
| Sandbox seeder exits because registration already created an Account | `backend/src/database/seeders/sandbox.seed.ts:20` | Phase 2: separate workspace identity from sample CRM records |
| Wizard order is workspace, invite team, quick tour | `frontend/src/features/tenant/pages/onboarding-page.tsx:265,343,420` | Phase 5: introduction, workflow, company setup |
| Wizard completes onboarding before Google company setup | `frontend/src/features/tenant/pages/onboarding-page.tsx:161` | Phase 3: only final company submission can complete onboarding |
| Invite step sends an empty role ID | `frontend/src/features/tenant/pages/onboarding-page.tsx:135`; `backend/src/modules/administration/invitations/invitations.dto.ts:5` | Phase 5: remove the onboarding invitation UI and requests |
| Three forms implement overlapping company setup | `frontend/src/features/tenant/pages/{onboarding-page,company-setup-page,complete-profile-page}.tsx` | Phase 5: retain one company form; old routes become adapters |
| Success goes to billing and does not clear the middleware flag | `frontend/src/features/tenant/pages/company-setup-page.tsx:66`; `frontend/app/company-setup/page.tsx:32` | Phases 4–5: database completion followed by Dashboard |
| Password presence/localStorage alter onboarding routing | `frontend/src/shared/providers/auth-guard.tsx:87`; `frontend/app/onboarding/page.tsx:19` | Phase 4: remove both as lifecycle inputs |
| Tenant name containing system passes frontend admin checks | `frontend/src/shared/providers/auth-guard.tsx:69`; `frontend/app/(system-admin)/layout.tsx:25` | Phase 4: exact authorized role checks only |
| Progress can jump, regress, or render no step | `backend/src/core/auth/auth.dto.ts:138`; `frontend/src/features/tenant/pages/onboarding-page.tsx:62,154` | Phase 3: defined transitions; errors never advance the UI |
| Any authenticated member can mutate tenant onboarding | `backend/src/api/routes/auth.routes.ts:78`; `backend/src/core/auth/auth.controller.ts:851,890,915` | Phase 3: verify same-tenant ownership and active/verified account |
| CRM data can render/load before redirect; APIs lack onboarding enforcement | `frontend/src/shared/providers/auth-guard.tsx:193`; `frontend/src/store/DataContext.tsx:670`; `backend/src/api/routes/crm.routes.ts:41` | Phases 3–4: enforce workspace readiness and suppress premature loading |
| Magic-link cookie is set on backend rather than frontend origin | `backend/src/core/auth/auth.service.ts:307`; `backend/src/core/auth/auth.controller.ts:383` | Phase 6: frontend-origin verification handoff |
| Proxy rewrites a deletion cookie into a seven-day empty cookie | `frontend/app/api/proxy/[...path]/route.ts:67` | Phase 6: preserve expiration/deletion semantics |
| Refresh swallows errors; auth errors are identified by text; permissions can be stale | `frontend/src/store/AuthContext.tsx:35,303,336,435` | Phase 4: consistent session application and explicit failure handling |
| Legacy OTP verification can reactivate an inactive user | `backend/src/core/auth/auth.service.ts:722,791` | Phase 2: verify only eligible accounts; never override administrative inactivity |
| Email lookup can select the wrong legacy duplicate account | `backend/src/core/auth/oauth.service.ts:143`; `backend/prisma/schema.prisma:377` | Phase 2: stable provider identity and explicit ambiguity handling |
| Website is collected but discarded; country is not persisted | `frontend/src/features/tenant/pages/company-setup-page.tsx:25,66`; `backend/src/core/auth/auth.controller.ts:741` | Phases 1, 3, 5: save website; remove the fabricated country payload |
| Repair script completes every incomplete tenant | `backend/src/scripts/fix-null-onboarding.ts:12` | Phase 7: replace with a dry-run, targeted repair |
| Existing specs/docs/tests contradict the real lifecycle | `.kiro/specs/onboarding-redirect-fix/design.md`; `docs/authentication.md:3` | Phase 8: retire conflicting guidance and test real behavior |

## 3. State contract and invariants

Reuse `Tenant.onboardingStep`, `Tenant.onboardingCompletedAt`, and
`Tenant.ownerUserId`. Define named numeric constants in the shared package.

| Step | Meaning while incomplete | Route |
| --- | --- | --- |
| 0 | LeadCRM introduction | `/onboarding` |
| 1 | Basic CRM workflow | `/onboarding` |
| 2 | Company Setup | `/company-setup` |
| 3 | Completed; requires a completion timestamp | `/dashboard` |

Rules:

- A new tenant always starts at step 0 with a null completion timestamp.
- `onboardingStep` records the current persisted resume position.
- Continue saves the next allowed position before navigation. Back saves the
  previous position before navigation. Both preserve any saved company data.
- Browser Back or a hand-edited URL cannot override the persisted resume state.
- Progress can move one adjacent step between 0, 1, and 2. It cannot set step 3.
- Final company submission is the only operation that sets step 3 and the timestamp.
- Completed tenants cannot be reset through progress or completion endpoints.
- Invalid stored combinations fail into a recoverable state; they never render
  an empty page or silently grant Dashboard access. Repair them explicitly.
- Company name, industry, password presence, and OAuth account age are not
  substitutes for onboarding state.
- AuthContext holds a current server response; it is not an independent durable
  state store. URL parameters and browser storage cannot grant completion.
- Tenant ownership and application role are separate. A Guest owner may finish
  its own workspace setup without acquiring Client Admin privileges.
- Existing members of a completed tenant retain their assigned roles and access.
- A non-owner in an incomplete tenant sees an owner-setup-required message in
  the existing onboarding shell, with refresh/sign-out actions and no company
  mutation controls. Do not create a separate member onboarding lifecycle.
- Only an actual System Admin role bypasses customer onboarding gates.
- Onboarding does not activate subscriptions or change pricing/plan restrictions.

## 4. File organization and code quality

Move responsibilities out of oversized files as they are changed. Extract real
cohesive behavior; do not add empty controller/service/repository layers merely
for symmetry. New modules below replace existing duplicated code.

| Area | Target responsibility and file |
| --- | --- |
| Shared API contract | Add `shared/src/contracts/auth.contract.ts` for canonical auth/session and onboarding responses; remove the competing auth shape from `user.contract.ts` and re-export through existing barrels |
| Shared validation/state | Add `shared/src/validation/auth.schema.ts` for account/company/progress inputs; `shared/src/constants/onboarding.ts` for step values and the small pure readiness rule |
| Auth response construction | Move the existing `buildAuthUserResponse` and its select definition into `backend/src/core/auth/auth-user.ts`; use it from login, verification, OAuth, and onboarding |
| Founder provisioning | Add `backend/src/core/auth/provision-workspace.service.ts`; owns required transactional tenant/owner/roles/pipeline creation for all self-service paths |
| Manual authentication | Keep `backend/src/core/auth/auth.service.ts` focused on password login and registration orchestration; preserve invitation association as a separate existing branch |
| Google authentication | Keep `backend/src/core/auth/oauth.service.ts` focused on verified identity lookup/linking and session issuance; delegate tenant creation |
| Verification | Extract `verification.service.ts` and `verification.controller.ts` under `backend/src/core/auth`; reuse credential generation for initial and resend email |
| Onboarding | Extract `onboarding.service.ts` and `onboarding.controller.ts` under `backend/src/core/auth`; move existing onboarding handlers rather than retaining parallel copies |
| Route enforcement | Keep authentication in `auth.middleware.ts`; add the small workspace-readiness check alongside tenant checks in `tenant.middleware.ts`; route groups opt into it explicitly |
| Frontend route decisions | Add `frontend/src/shared/auth/auth-routing.ts`; pure destination/access decisions only, using the shared state rule; no fetch or React state |
| Frontend session state | Keep AuthContext as the sole LeadCRM session provider, with one internal apply/clear path; AuthGuard renders loading/error/redirect/allowed states |
| Feature UI | Use `frontend/src/features/tenant/onboarding/ui` for the onboarding shell, introduction content, and company form; one `hooks/use-onboarding.ts` for progress/submission behavior |
| API requests | Extend existing `frontend/src/shared/services/auth.api.ts`; do not create a second auth/onboarding API client |
| Page routes | Keep existing `frontend/app` routes as thin shells that mount the feature UI and existing guard |
| Server cookie forwarding | Extract a small `frontend/src/lib/auth/cookies.ts` from the existing proxy; reuse it in proxy responses and verification handoff |

Presentation-only introduction pages can be two content entries rendered by one
component. Separate components only when structure or behavior warrants it.
Use the existing page component exports as temporary re-exports if needed, then
remove unused wrappers after imports migrate.

Review standards:

- One clear responsibility per file and named functions with explicit contracts.
- Prefer roughly 100-character lines, multiline JSX/objects/calls, and short
  handlers. Avoid compressed one-line business logic and nested ternaries.
- Aim for feature components/services under about 250 lines. This is a review
  guideline, not a reason to split cohesive code into many trivial files.
- No new `any`, unchecked response casts, duplicate field interfaces, or swallowed
  errors in the touched lifecycle. Use the shared contract and typed API errors.
- Controllers translate HTTP; services enforce business rules and transactions;
  UI components render; hooks coordinate UI actions.
- Reuse existing Prisma client, role constants, email transport, and UI primitives.
- No new state library, routing framework, generic onboarding engine, or second
  authentication system. `google-auth-library` is already installed.
- Preserve unrelated working-tree changes, particularly AuthContext and API-client
  cache work. Review edits against that baseline before each implementation phase.

## 5. Ordered implementation phases

### Phase 1 — Shared contracts and database preparation

- [x] Define the state contract from section 3 and typed error codes for invalid
  progress, onboarding required, ownership required, and verification required.
- [x] Standardize the auth user response: identity, role, user status,
  emailVerified, tenant identity/name/status, subscription/plan, company fields,
  onboarding step/timestamp, and a server-derived `isTenantOwner` boolean.
- [x] Preserve `hasPassword` only for account-management display if needed;
  remove it from lifecycle decisions. Serialize API dates consistently as strings.
- [x] Share account, password, company, and step validation across frontend and
  backend. Trim names, normalize emails, bound lengths, validate website URLs,
  and enforce terms acceptance server-side for self-service manual registration.
- [x] Make company data unnecessary at initial manual registration. Use a neutral
  temporary tenant name to satisfy the existing non-null column.
- [x] Add one optional `Tenant.website` column to persist the existing website
  input. Reuse `User.timeZone` for the detected timezone. Remove the hardcoded
  `country: 'US'`; do not introduce a country feature as part of this fix.
- [x] Update exports/types together; do not hand-maintain competing JS/TS copies.

Exit check: one shared contract compiles in both workspaces; schema change is
additive. No new onboarding table, role, status column, or framework is needed.

### Phase 2 — Secure authentication and consistent Guest provisioning

- [x] Verify Google ID tokens using the existing Google library and the configured
  client audience; reject invalid signature, issuer, expiry, audience, subject,
  or required verified-email claims before account lookup.
- [x] Derive identity from verified claims. Never trust caller-supplied email,
  provider subject, or verification boolean as authentication proof.
- [x] Look up stable provider association first. Normalize email fallback;
  ambiguous legacy email matches must return a recoverable account-linking error,
  not select an arbitrary tenant or create another workspace.
- [x] Preserve inactive-account blocks. Pending manual accounts must finish their
  existing email verification before linking Google; provide a clear recovery
  message. Do not reactivate them implicitly through the OAuth path.
- [x] Link existing active accounts only with sufficient proof of ownership.
  For non-Google-hosted email, require the existing account's verification/sign-in
  proof instead of treating the Google email claim alone as current ownership.
- [x] Both new-user paths call the same provisioning routine: Guest role,
  SANDBOX/NONE/null-plan tenant, step 0/null completion, ownerUserId, default role
  definitions, Guest UserRole, free limits, and default pipeline/stages.
- [x] Make required provisioning atomic. Adapt existing role seeding to accept
  a Prisma transaction client, rather than creating another role seeder.
- [x] Prevent concurrent retries from creating duplicate founders/workspaces:
  perform identity checks inside a serializable provisioning transaction with
  bounded conflict retries; handle provider-unique conflicts by re-reading.
  Preserve tenant-scoped member email uniqueness; do not impose a global unique
  email constraint as an unrelated migration.
- [x] Stop representing the workspace company as a CRM customer Account during
  signup. Existing customer data is not deleted or renamed by this change.
  Keep the existing sandbox sample-data behavior isolated and consistent across
  both methods; make its seeder use the provisioning transaction so failure cannot
  leave a committed but unusable registration. Seed only on new tenant creation.
- [x] Registration verification targets eligible pending accounts; consume OTP
  or link credentials atomically, enforce attempt/expiry limits, invalidate the
  alternate credential, and never change an INACTIVE account to ACTIVE.
- [x] Reuse one verification credential generator, cryptographically secure OTP
  generation, email sender, and current session service. Surface email-delivery
  status so the UI can offer resend after account creation.
- [x] Return the canonical user state for all authenticated results. Remove
  provider-specific completion decisions. Keep backend tokens server-side in the
  NextAuth bridge; stop exposing an unused backend token in the browser session.

Exit check: successful signup by either method produces equivalent Guest-owned
workspaces; forged Google tokens, duplicate retries, and disabled users cannot
obtain unintended access. Existing-account login never recreates a tenant.

### Phase 3 — One authorized onboarding service

- [x] Move onboarding DB operations from auth.controller into the dedicated
  service; thin controllers use shared validation and existing error handling.
- [x] Authorize mutations against the authenticated user's active/verified state,
  tenantId, and the tenant's ownerUserId. Do not accept ownership or tenantId
  from the body, and do not require Client Admin for a Guest owner to proceed.
- [x] Progress endpoint accepts `expectedStep` and the requested adjacent `step`.
  Perform a conditional update against persisted step/completion so stale tabs
  cannot move a completed tenant backward. Conflict returns current state.
- [x] Final completion requires persisted step 2 and validated company name,
  industry, company size, optional website, and timezone. Update company fields,
  user timezone, step 3, completion time, and completion audit atomically.
- [x] Repeated completion returns current state without changing company data,
  role, timestamp, or repeating the completion audit/welcome-email attempt.
  Later company edits belong in existing settings, not onboarding endpoints.
- [x] Send the welcome email after a successful first transition; transport
  failure does not undo setup. No new queue/outbox is required for this task;
  exactly-once email delivery is not promised.
- [x] All successful mutations return the canonical user state so the frontend
  can update AuthContext without an additional `/auth/me` call.
- [x] Add server workspace-readiness enforcement for CRM/operations/marketing/
  automation/reporting and workspace-administration access. Keep authenticated
  session, onboarding, own-permission hydration, personal account recovery, and
  necessary billing recovery endpoints reachable. Use explicit routes, not a
  blanket `/settings` or `/administration` exemption.
- [x] Preserve subscription/RBAC checks after readiness. Database errors fail
  closed with a recoverable error; browser redirects are not API authorization.

Exit check: neither endpoint calls nor concurrent tabs can bypass company setup,
alter another tenant, mutate as a non-owner, or promote a Guest role.

### Phase 4 — Deterministic frontend routing and session state

- [x] Centralize route resolution in `auth-routing.ts`: unresolved/error state,
  authentication, account eligibility, System Admin portal, verification,
  onboarding position, then permitted destination.
- [x] Use that resolver in root/login/register entry behavior, AuthGuard, and
  onboarding/company shells. Route effects execute its result; they do not
  reimplement the conditions. Avoid replacing a URL with itself.
- [x] Completed users visiting onboarding/setup go to Dashboard. Incomplete users
  requesting Dashboard or a future onboarding step go to their saved position.
- [x] Validate saved destinations as same-origin internal paths and check portal
  eligibility. They cannot override verification or onboarding. Initial onboarding
  completion goes to Dashboard; clear obsolete saved destinations at completion.
- [x] Remove tenant-name/password/industry/localStorage completion heuristics and
  the tenant-name System Admin fallback. Ignore old browser flags; clean them up
  during normal session cleanup, without reading them for access decisions.
- [x] Keep AuthContext as the source of frontend session snapshots. Apply login,
  OTP, and onboarding mutation responses through one internal session-update
  path. Restore with `/auth/me` on initial load; no second status fetch per page.
- [x] Fetch effective permissions once when identity changes; clear them on logout
  or identity switch. Ignore stale responses from a previous user/session.
  Preserve existing periodic refresh without duplicating the initial request.
- [x] Make refresh errors visible and classify no-session responses using HTTP
  status, not message matching. A transport error must not be mistaken for logout
  or completion. Do not navigate as though a failed state update succeeded.
- [x] AuthGuard renders loading/error/pending-redirect UI until access is allowed.
  DataContext defers protected CRM data loading until the same readiness rule
  passes and reloads once when completion becomes true, even if userId is unchanged.
- [x] Remove `requiresProfileCompletion` as route authority from NextAuth. Keep
  Google OAuth handling and use the canonical LeadCRM cookie/session after return.
- [x] Delete `frontend/middleware.ts` once consumers use the resolver. The audited
  middleware only adds conflicting lifecycle redirects; backend authorization and
  client route guards remain. No Next.js upgrade or replacement proxy.ts is needed.

Exit check: routing is identical for manual and Google users with the same database
state, regardless of tenant name, stale flags, password presence, or browser history.

### Phase 5 — Small, reusable onboarding UI

- [x] Simplify manual registration to account details, password confirmation, and
  terms. Preserve validation/error handling and Google sign-in entry.
- [x] Introduction: explain what LeadCRM is and how it organizes customer work.
- [x] Workflow: explain leads, accounts/contacts, deals/pipeline, and activities
  or follow-ups. Keep copy informational; no data import, invitations, or billing.
- [x] One onboarding shell shows progress and renders the relevant content.
  `use-onboarding` submits transitions and applies returned server state.
- [x] Reuse/refactor the existing Company Setup UI into one shared company form.
  Prefill existing values from AuthContext; retain typed drafts on failed saves.
- [x] Remove all onboarding invite state, handlers, role selection, API requests,
  and copy. Preserve unrelated team administration/invitation functionality.
- [x] Final submit saves and completes through the shared endpoint, applies its
  canonical response, and navigates to Dashboard. Remove the billing-only success
  detour and redundant company forms.
- [x] `/auth/complete-profile` becomes a compatibility entry that resolves current
  state rather than presenting its own form or performing another auth fetch.
- [x] Both information steps and company form have keyboard-accessible controls,
  visible saving/error states, disabled duplicate submit, and responsive layout.
- [x] Keep mock behavior explicit and isolated. Real signup/OAuth correctness is
  tested with real-auth configuration; no-op mock registration is not evidence
  of a working lifecycle. UI previews may use existing fixtures.

Exit check: first-time users see introduction first; Company Setup is last; no
invitation or plan selection occurs; components and hooks remain focused.

### Phase 6 — Cookie transport, magic links, and logout

- [x] Keep the same-origin `/api/proxy` for the current separate-origin deployment.
  Use one browser API transport in development and production where practical;
  avoid introducing another auth-specific API client.
- [x] Extract cookie forwarding from the existing proxy. Preserve expiry,
  Max-Age, deletion, HttpOnly, Secure, and intended SameSite semantics; remove
  incompatible Domain attributes and use Path=/ for the LeadCRM cookie.
  Never convert an expired/deletion cookie into a live seven-day cookie.
- [x] Add a narrow frontend handler at `frontend/app/api/verify-email/route.ts`.
  Verification emails point to this frontend-origin URL with the one-time token.
- [x] That handler calls the backend verification endpoint server-to-server with
  explicit JSON response negotiation and redirect following disabled. The backend
  consumes the credential, creates the session, and returns its cookie plus
  canonical state. The frontend forwards the cookie and redirects to `/`, where
  the same resolver chooses the correct page. Never put a session JWT in a URL.
- [x] Preserve already-issued backend-host verification URLs by making their
  browser-mode handler redirect the unconsumed verification token to the frontend
  handoff. JSON-mode verification is the single consumption implementation.
- [x] Ensure verification/error responses are not cached, external destinations
  cannot be injected, token values are not logged, and retries/used links have
  clear recovery behavior. Keep existing rate limits on token consumption.
- [x] Logout revokes the backend session, expires the frontend cookie, signs out
  NextAuth, and clears user/tenant/permissions/cache/saved redirects. Persistent
  onboarding progress remains unchanged. Report failure to end a server session
  instead of silently claiming logout succeeded when the backend is unreachable.

Exit check: OTP, magic link, password login, and Google login establish the same
usable LeadCRM session on separate origins; logout remains effective after refresh.

### Phase 7 — Targeted existing-data repair

The tool is implemented and type-checked. Data classification, backup, and apply
items remain unchecked because no target database has been modified.

- [ ] Inventory affected rows with a read-only dry run: invalid state combinations,
  incomplete tenants, missing owner/roles/pipeline, and Google-created Client Admin
  founders with no legitimate promotion. Report counts and reasons, not credentials.
- [x] Replace `fix-null-onboarding.ts` and its blanket behavior. Default repair mode
  is dry-run; execution consumes a reviewed list of exact IDs and expected values.
- [ ] Map genuine incomplete legacy tenants to step 0 because old invite/tour step
  values do not mean the new introduction was seen. Preserve existing company
  values for final confirmation. Do not reset legitimately completed tenants.
- [ ] Where old completion timestamps are suspect, use available audit records,
  known creation history, and setup evidence. Do not infer completion merely from
  a name, and do not erase ambiguous completion timestamps automatically.
- [ ] Repair wrongly elevated Google founders only with evidence they were created
  by the buggy path and were never legitimately promoted. Never blanket-demote
  all Client Admins or change paid/admin/member roles.
- [ ] Update User.role and UserRole together, preserve correct ownerUserId, and
  revoke affected sessions so old JWT role claims cannot retain excess access.
- [ ] Backfill required role definitions/pipeline idempotently without duplicating
  existing data. Do not inject demo/sample records into existing customer tenants.
- [ ] Missing ownership or conflicting identity mappings require explicit reviewed
  assignments; do not guess the owner by choosing the first user.
- [ ] Back up relevant rows and record before/after changes. Use conditional writes
  so a repair cannot overwrite a user's concurrent legitimate setup or upgrade.

Exit check: reviewed repair changes only eligible rows; production data and
legitimate subscription promotions are preserved. No repair runs during planning.

### Phase 8 — Cleanup, regression coverage, and release

- [x] Remove unused credentials provider, duplicate NextAuth type declarations,
  duplicate session-refresh wrappers, obsolete company forms, and localStorage
  completion constants after verifying references.
- [x] Update `docs/authentication.md` and the auth section of `docs/API.md`; mark
  conflicting older onboarding specs as superseded with a link to this plan.
- [x] Replace tests that assert named tenants may bypass incomplete onboarding.
  Test imported production functions/components/handlers, not pasted copies of
  conditions or mocked cookie-header accessors alone.
- [ ] Run the test matrix below, workspace lint, schema validation, and builds.
  Separate pre-existing failures from regressions introduced by this work.
- [x] Review the final diff for unrelated changes, repeated DB/API calls, overly
  large files, unsafe catches, and dead compatibility code.

## 6. API consolidation

| API | Final responsibility |
| --- | --- |
| `POST /auth/register/guest` | Account-only self-service registration; Guest-owned incomplete workspace |
| `POST /auth/register/client-admin` | Legacy public name delegates new founders to the same Guest provisioner; preserve invitation association semantics |
| `POST /auth/login`, `GET /auth/me` | Canonical authenticated account/workspace response |
| `POST /auth/oauth/google` | Verified Google identity exchange; no separate onboarding policy |
| OTP/link verification | One activation/session path; canonical user response and cookie |
| `PATCH /auth/onboarding/step` | Authorized adjacent transition with expectedStep and current state response |
| `POST /auth/onboarding/complete` | Validated company save plus atomic completion; canonical state response |
| `GET /auth/onboarding/status` | Remove frontend dependency; temporarily retain as a read adapter if compatibility requires it |
| `PATCH /auth/onboarding/workspace` | Retire old early-company-save behavior after callers migrate |
| `PATCH /auth/oauth/complete-profile` | Retire provider-specific completion; any temporary adapter must use the same service, validation, ownership, and step checks |

Old requests must never remain an alternative bypass. During deployment, outdated
clients receive a clear refresh/recovery response when their payload cannot satisfy
the new contract. An empty legacy completion request must not complete onboarding.

## 7. Regression and acceptance matrix

| Scenario | Required result |
| --- | --- |
| New manual registration | PENDING Guest, owned SANDBOX/NONE tenant, step 0/null completion |
| Valid manual OTP | ACTIVE verified Guest session; first introduction |
| Valid manual magic link across separate origins | Same session and destination as OTP |
| New Google signup | Verified ACTIVE Guest with equivalent tenant provisioning; first introduction |
| Existing Google association at steps 0/1/2 | Same tenant and saved step; no new workspace or forced Dashboard |
| Login to completed workspace | Dashboard or valid permitted saved destination |
| Refresh or logout/login at each incomplete step | Restore database step; no reset or skip |
| New browser or cleared browser storage | Same behavior from server state |
| Stale localStorage/NextAuth flags or changed password | No effect on onboarding eligibility |
| Direct future-step/Dashboard URL | Redirect before protected content/data mounts |
| Company name contains system | No admin bypass |
| Real System Admin | Existing admin portal and authorization preserved |
| Non-owner in incomplete workspace | Cannot submit onboarding mutations; owner-required UI |
| Member in completed workspace | No repeated company setup; existing role retained |
| Forged/expired/wrong-audience Google token | No linking, account creation, or session |
| Pending/manual or ambiguous email linking | Explicit verification/recovery; no guessed association |
| Inactive account via password/Google/OTP/link | No unintended reactivation or session |
| Duplicate/concurrent signup | One identity association and workspace; required records atomic |
| Incorrect/expired/replayed verification credential | Rejected; no extra activation/session |
| Failed progress/company request | Stay on current step, retain draft, show actionable error |
| Two tabs advancing/backtracking/completing | Conflicts reconcile to current state; completed state cannot regress |
| Repeated completion | Stable completion timestamp/role; no duplicate completion audit/email attempt |
| Company fields including website | Persist and rehydrate correctly |
| Company completion | Dashboard; user still Guest; no mandatory billing redirect |
| Owner attempts another tenant ID | Request cannot escape authenticated tenant scope |
| Direct CRM API before completion | Onboarding-required response even without frontend guard |
| Guest after completion | Existing free-plan RBAC/limits still apply |
| Session/permission identity switch | Previous user's late responses/permissions cannot carry over |
| Auth transport failure | Visible recovery; not a false logout or false completion |
| Logout then refresh | Both sessions cleared/revoked; onboarding progress retained |
| Cookie forwarding | Real handler preserves multiple cookies and deletion/expiry semantics |
| Team invitations | No onboarding controls/calls; unrelated administration still works |
| Data repair | Dry-run by default; idempotent targeted updates; legitimate accounts preserved |

Use existing Vitest and React Testing Library infrastructure for unit and
integration coverage. Mock external email/Google services, not the lifecycle under
test. Run transaction/concurrency checks against an isolated test database.
Perform a browser smoke test with a real Google test account and separate
frontend/backend origins before release; do not claim mocks prove the live flow.

Commands after implementation, never as a substitute for lifecycle tests:

```text
npm --prefix backend test -- <focused auth/onboarding test files>
npm --prefix frontend test -- <focused auth/onboarding test files>
npm run lint
npm exec --workspace backend -- prisma validate
npm run build
```

Run Prisma generation after the additive schema change. Apply migrations only to
the intended environment; do not run development migrations against production.

## 8. Deployment and rollback

1. Capture the existing uncommitted baseline and prepare a cohesive reviewed diff.
2. Apply the additive website column migration before code that selects it.
3. Deploy the Google verification security fix with its required backend client-ID
   configuration. Verify rejection paths before enabling the revised signup flow.
4. Prepare the reviewed data classification/repair for legacy rows before strict
   routing would expose them to invalid-state errors.
5. Coordinate backend contract enforcement and frontend routing/UI rollout. Old
   clients receive recovery responses rather than retaining completion bypasses.
6. Apply the reviewed repair with backups and conditional writes; revoke sessions
   for corrected role assignments. Complete the separate-origin smoke tests.
7. Observe auth/onboarding errors, unexpected redirect repetition, and provisioning
   failures without logging tokens or unnecessary personal data.

Rollback keeps security verification and server authorization fixes. The optional
website column can remain. Do not restore the old blanket-completion script or
unsafe Google bridge. If the UI rollout fails, disable affected signup entry points
temporarily or ship a forward fix; do not restore incompatible redirect rules.
Reverse data repairs only from recorded before-values after checking that no
legitimate onboarding or subscription changes occurred afterward.

## 9. Completion checklist

Unchecked runtime items below require the isolated-database and live acceptance
checks; passing mocked tests does not close those release requirements.

- [x] Both entry points start as Guest and converge at the same first information page.
- [x] One durable onboarding state, one frontend route policy, one completion service.
- [x] Company Setup is final and is the only way to mark completion.
- [x] No Invite Team step or mandatory billing step.
- [ ] Refresh, re-login, different browsers, and stale tabs behave deterministically.
- [ ] Required provisioning, ownership, permissions, and API access are correct.
- [ ] Google identity verification and cross-origin cookie flows are tested.
- [ ] Focused tests, lint, schema validation, builds, and live smoke checks are recorded.
- [ ] Historical data repair is reviewed separately from schema/code deployment.
- [x] Changes are organized into focused modules with no parallel implementations.
- [x] No unrelated working-tree changes are overwritten.

Planning creates only this document. Application edits, migrations, data repairs,
and deployment are not performed as part of preparing the plan.
