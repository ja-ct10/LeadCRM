# Final role model and deployment notes

System Admin uses the existing password/JWT/session mechanism and dedicated system-container User record. The required tenant foreign key remains an implementation container, not client membership. CRM routes reject operators; platform routes reject tenant accounts. The historical SystemAdmin table is not used for login and is retained without data deletion.

Client Admin is the only predefined tenant role. It requires a valid @camxian.com employee email and follows sign in → required password change → required LeadCRM onboarding → dashboard. Provisioning remains in the existing System Admin tenant service. Subscriptions never grant roles.

Client Admin creates custom roles and explicitly selects one when creating/inviting staff. No baseline User role is necessary. Existing definitions named User retain their assignments and permissions but become editable custom roles. User.role carries the primary identity; UserRole is its assignment relationship to RoleDefinition/RolePermission, not a duplicate RBAC implementation. Primary assignment changes and role renames synchronize the relevant records transactionally. Permissions resolve only from active same-tenant assignments and rows, without static fallback grants.

## Migration

`20261001000000_retire_guest_role` removes User.role and TenantDomainSettings.defaultRole defaults. It disables historical Guest accounts (including users linked to those definitions), archives Guest definitions, revokes inactive-account sessions and pending archived-role invitations, and clears obsolete domain defaults. PostgreSQL CHECK constraints prohibit active Guest identities/definitions and Guest domain defaults. SQL-only checks are intentionally in the migration because Prisma 5 does not express CHECK constraints in its datamodel.

No users, assignments, permission records, tenant ownership, or CRM data are deleted. No account is promoted or assigned a replacement role. Restoring a retired employee requires selecting a real custom role through user management and then restoring the account. Nonemployee addresses remain blocked and require an administrator's separate identity review.

Run the read-only `backend/prisma/role-migration-preflight.sql` against the deployment database before applying migrations. Review nonemployee Client Admins, cross-tenant assignments, and missing primary assignments: this implementation denies invalid assignments and does not invent permissions or rewrite employee identities. The production database has not been queried or modified during this task.

## Verification

- `prisma validate` and `prisma generate`: passed.
- `npm run lint`: all three workspaces passed TypeScript checks.
- `npm run build`: backend and frontend production builds passed.
- Backend suite: 343 tests passed, including retired login/session rejection, reserved role creation/rename, permission denial, invitation validation and tenant-scoped assignment tests.
- Frontend suite: 592 tests passed; 79 focused auth/navigation tests passed again after mock-session hardening.
- `backend/prisma/verify-role-migration.cjs`: applied the new migration to a disposable local PostgreSQL database containing representative legacy data. Verified retained identities/ownership/assignments/grants, revocation, constraints, and zero Prisma datamodel difference.
- `backend/prisma/verify-role-http.cjs`: built API starts against migrated PostgreSQL. Real HTTP checks passed for System Admin separation, password change before onboarding, Client Admin role/user creation, custom permission enforcement and immediate revocation, and cross-tenant assignment denial. No invitation email was sent.

Both verification scripts require DATABASE_URL and DIRECT_URL to identify the same disposable local database named `role_migration_test`. Run migration verification on a fresh database, then HTTP verification after the backend build. Never use these fixture scripts against deployment data.

Fresh replay of all 51 migrations is blocked by an existing historical migration: `20260912135216_add_business_verification` fails with PostgreSQL 42703 because TenantDocument.documentKey does not yet exist. The new migration is later and cannot fix an earlier failed migration. Applied migrations were not edited; an operator must reconcile existing migration history before a fresh deployment. The new migration itself was separately applied and verified successfully.

The frontend build warns that its API URL resolves to localhost in this environment. Deployment must supply the actual backend URL.

## Remaining Guest references

- Existing migrations are immutable historical records; the new retirement migration, preflight, and regression fixtures intentionally refer to the retired name.
- Backend deny/reserved-name checks and mock-storage rejection prevent the retired role from returning.
- Historical registration/onboarding/capstone documents are marked superseded. The external-prospect journey uses “guest” as a customer description, not an application role.
- `.kiro/specs/roles-permissions` and `.kiro/specs/onboarding-redirect-fix` retain historical design/task references; this final model supersedes them. The hospitality design CSV refers to hotel guests and is unrelated.
- Ignored `.next-dev` and `frontend/build/onboarding-check` files contain older generated development artifacts. They are not source or the verified production build; restart/rebuild any older dev process before reviewing the updated UI.
- No active provisioning, seeder, default, selector, permission grant, onboarding transition, or subscription promotion assigns Guest.

Removed obsolete files: Guest workspace provisioner, sandbox data seeder, old role migration script, and old onboarding repair script. Their executable package scripts were removed. Public OAuth account provisioning now fails closed.

Frontend changes cover user management, settings users/domains, role templates/constants, permission hooks, command palette, account switcher, mock role/user records, and persisted mock sessions. Existing thin route shells and Client Admin/System Admin routing remain in place.
