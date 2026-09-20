# Authentication and onboarding

LeadCRM is an internally managed CRM for Camxian Technologies. PostgreSQL is the source of truth for account status, roles, password-change requirements, and onboarding. Existing bcrypt hashing, HttpOnly cookies, JWT verification, database sessions, tenant scoping, and RBAC remain in use.

## Supported flows

- Client Admin: sign in with employee email/password → change temporary password when required → informational LeadCRM onboarding when the workspace has not acknowledged it → dashboard.
- Returning Client Admin: sign in → dashboard.
- System Admin: sign in → System Admin dashboard. Tenant onboarding and first-login gates do not apply to platform operators.
- Users/custom roles: employee sign in → password change when required → CRM with their existing role permissions.

All tenant portal accounts use an exact, case-insensitive @camxian.com domain. Subdomains and suffix lookalikes are rejected. System Admin accounts are separately provisioned and exempt from the employee-domain rule. The backend checks the domain at password login and on every authenticated request, including existing sessions. Inactive accounts and suspended/rejected workspaces are denied access.

## Internal provisioning and passwords

System Admin provisioning uses POST /admin/tenants. It creates an active Client Admin, initializes the existing roles and default pipeline, and accepts an administrator-supplied temporary password. No subscription, checkout, pricing plan, or sample CRM data is created.

Tenant user management also marks provisioned passwords as temporary. When no password is supplied it generates a cryptographically random value; the employee must use password recovery to choose a password. No shared default password is embedded in frontend code.

User.mustChangePassword is persisted. Until cleared, authenticated tenant users can read /auth/me, change their password, or log out. Other protected APIs, including onboarding completion and preference endpoints, reject requests with PASSWORD_CHANGE_REQUIRED.

POST /auth/change-password accepts currentPassword and password. It checks the current hash, enforces the existing shared strong-password policy, rejects password reuse, writes the new hash, clears the flag, revokes all sessions and reset tokens, and records an audit event in one serializable transaction. The frontend signs in again with the new password to obtain a fresh HttpOnly session. Password recovery uses the same strength policy, clears the flag, and revokes sessions.

User update and bulk-update payloads have an explicit allowlist. They cannot inject mustChangePassword, passwordHash, or tenantId. Primary-role changes synchronize User.role and UserRole in the same transaction; custom permission definitions remain unchanged.

## Informational onboarding

The existing Tenant.onboardingCompletedAt and onboardingStep fields are reused. A Client Admin explicitly selects Continue to dashboard after reading about leads, customers/accounts, pipelines, tasks, and workflows. The backend stores the acknowledgment timestamp and completed step (3), without company setup, payments, documents, or role promotion.

Completion is workspace-wide, matching the existing data model. Additional Client Admins in an already acknowledged workspace do not repeat it. Existing completion timestamps are preserved; unfinished legacy steps all display the information page. System Admins cannot submit Client Admin onboarding. Custom-role users are not required to perform Client Admin onboarding.

## Invitations and recovery

Administrator-issued invitations remain supported through POST /auth/invitations/accept. A valid, unexpired, single-use invitation bound to the employee email and tenant is required. System Admin roles cannot be invited through the client portal. Invitees choose their own strong password, so they enter active with mustChangePassword=false and no OTP step. Invitation creation still requires the existing users.manage permission.

Public signup, Google account sign-in, OTP, email-verification sessions, company setup, and old onboarding progress endpoints are disabled. NextAuth and magic-link bridge routes return 404. Gmail OAuth remains a separate CRM email integration.

## Deployment

Apply migration 20260919000000_internal_accounts before starting the new backend. It adds User.mustChangePassword with default true, exempts existing System Admins, and changes the default new-user role to User. Existing non-System Admin accounts will be asked to change their password once. Passwordless legacy Google accounts need password recovery or administrator provisioning.

The migration does not rewrite email addresses, promote Guest accounts, erase historical subscriptions, or modify existing custom-role permissions. Legacy Guest records are retained for compatibility; new tenant role seeding offers Client Admin and User, with custom roles managed through the existing RBAC tools.

See [implementation and retirement inventory](plans/internal-camxian-crm.md) for affected files, preserved dependencies, and verification.
