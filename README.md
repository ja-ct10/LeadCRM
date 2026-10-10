# LeadCRM

LeadCRM is the internally managed CRM for Camxian Technologies. It combines customer records, a governed sales pipeline, Tasks, Workflows, Forms, Campaigns, Gmail Inbox, reporting, and team settings. Start at `/login`.

The codebase is a Turborepo monorepo with Next.js, Express, TypeScript, PostgreSQL/Prisma, and the shared `@leadcrm/shared` contracts. The workspace supports Client Admin and permission-based custom staff roles. Tenant isolation remains enforced even though the current product is an internal CRM.

## Current modules

| Module | Primary entry point | Integration |
| --- | --- | --- |
| Dashboard and Reports | `/dashboard`, `/reporting` | The same authorized server aggregates, date definitions, revision events, and CSV export |
| Leads, Contacts, Accounts | `/crm/leads`, `/crm/contacts`, `/crm/accounts` | Customer relationships, conversions, imports, files, Product Interests, and related Deals/Tasks |
| Deals and Pipeline | `/crm/deals`, `/crm/pipeline` | Product price snapshots, ordered associations, governed stage transitions, and activity |
| Tasks | `/operations/taskboard` | Immutable creator, current Assigned Agent, contextual CRM associations, completion, archive, and Manila calendar dates |
| Workflows | `/automation/workflows` | Saved triggers/conditions/actions, role and Group assignment pools, execution history |
| Forms | `/marketing/forms` | Published guest forms at `/forms/:publicId`, validated submissions, CRM capture |
| Campaigns | `/marketing/campaigns` | Single-source audiences, field personalization, Send Now/Schedule Once, Brevo email, TextBee SMS, provider status/webhooks |
| Inbox | `/inbox` | Scoped Gmail history, drafts, replies, scheduled message review/cancellation, CRM relationships |
| Settings and team administration | `/settings` | Profile, users, Groups, roles, Products, Customize Fields, Archived Data, organization settings |
| Notifications and Help | `/notifications`, `/help` | Permission-aware destinations, personal notification preferences, product guidance |

Public signup, a separate platform portal, SaaS billing, service orders, technician dispatch, asset inventory, and customer invoicing are retired. Historical documents are background; the current route registrations and shared contracts define supported functionality.

## Groups replace Department

Group membership has one source of truth: `TenantGroupMember`. User administration accepts `groupIds`; User and auth responses expose `groups: [{ id, name }]`. Client Admin manages memberships in the user form or existing Groups screen. Profile displays memberships read-only. Workflows use these same Groups for assignment; roles continue to control permissions.

The forward migration preserves existing memberships and turns each nonempty legacy Department into a Group in the same tenant, reusing an existing case-insensitive name match before dropping the retired column. Multiple memberships remain supported.

The protected default Sales Group has stable key `SALES`; renaming its display label preserves routing. Membership remains administrator-managed. New public-form Leads rotate only among its eligible members, with a transactionally persisted cursor and request-ID retries consuming one turn. Returning records retain their agent. See [Forms verification](docs/forms-production-report.md).

## Local development

Use the project-pinned npm version from `package.json` and a supported Node version (20.19+, 22.13+, or later). A local PostgreSQL instance is required for API-backed development.

1. Run `npm install` from the repository root.
2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`. Use development database/provider credentials. Set frontend `API_URL=http://localhost:4000/api/v1`; browser requests use `/api/proxy`.
3. Generate Prisma with `npm --prefix backend run db:generate`. Apply migrations to the disposable/local database with `npm --prefix backend run db:migrate`. Existing deployments use the forward rollout described below.
4. Start `npm --prefix backend run dev` and `npm --prefix frontend run dev` in separate terminals, or use `npm run dev`.
5. Provision local accounts using the documented [authentication flow](docs/authentication.md). Startup does not run seeds automatically.

Mock auth and data are separate development-only switches, `NEXT_PUBLIC_USE_MOCK_AUTH` and `NEXT_PUBLIC_USE_MOCK_DATA`. They are disabled in production. Mocks support UI work; they do not verify database, permission, or provider behavior.

## Checks

- `npm run lint`: shared/backend/frontend TypeScript checks.
- `npm run build`: workspace production builds and generated shared JavaScript synchronization.
- `npm --prefix backend run test`: backend Vitest suite.
- `npm --prefix frontend run test`: frontend Vitest suite.
- `npm --prefix backend run test:rollout`: guarded migration deployment planning checks.
- `npm --prefix backend run test:migration-scripts`: historical migration checks under the native Node test runner with disposable PGlite data.
- `node backend/scripts/test-polish-isolated.mjs`: disposable PostgreSQL-compatible migration/HTTP tests for the Groups changes. It does not use the configured application database.

## Forward rollout

Stop old backend processes, then apply the existing migration history and these new migrations before starting the updated backend:

1. `20261116000000_user_groups`: preserving Department-to-Groups conversion.
2. `20261117000000_campaign_submission_recovery`: durable submission leases/attempt markers and `INTERRUPTED` status.
3. `20261118000000_group_revisions`: Group changes join the existing authenticated access-revision stream.
4. `20261119000000_notification_utc_timestamps`: consistent UTC defaults for new notification/outbox records; historical timestamps remain preserved.
5. `20261120000000_password_recovery_security`: protected password-recovery token storage.
6. `20261121000000_mailbox_reply_header`: nullable provider reply metadata.
7. `20261121000000_task_creator_sales_group`: immutable nullable Task creator, reliable audit backfill and protected Sales Group provisioning. Resolve ambiguous case-insensitive legacy Sales names before rollout; this migration refuses to silently merge them.
8. `20261123000000_campaign_schedule`: Scheduled status, approved schedule configuration/actor, and audience match mode (AND by default).
9. `20261124000000_crm_content_revisions`: committed CRM-content revision counter/triggers and stable Activity cursor index.

Follow `npm --prefix backend run db:deploy` and the existing [normalization rollout](docs/csv-import-normalization.md) and [relationship retirement](docs/database/normalization-report.md) prerequisites. Regenerate Prisma/build, then start the updated backend and verify authentication, membership visibility, assignment options, reporting, and recovery. Do not run old backend binaries after the Department column is removed.

An interrupted Campaign preserves uncertain provider outcomes for review and does not automatically resend them. Scheduled Inbox cancellation competes atomically with the worker; delivery already in progress cannot be cancelled as though it were unsent.

Campaign Schedule Once uses Asia/Manila input and UTC storage. Due dispatch resumes from persisted schedules after restart, rechecks current eligibility/authorization, and reuses the existing sender. Unclaimed cancellation/rescheduling competes atomically with dispatch. No exact-second execution is promised while the backend is offline.

## Documentation

- [Architecture](docs/ARCHITECTURE.md), [project structure](docs/STRUCTURE.md), [API reference](docs/API.md)
- [System polish plan](docs/plans/system-polish.md)
- [Appearance verification](docs/verification/appearance-polish.md), [responsive navigation and PWA verification](docs/verification/responsive-pwa.md)
- [Authentication and onboarding](docs/authentication.md), [security cleanup](docs/security-cleanup-mfa.md)
- [Dashboard definitions](docs/dashboard-kpis.md), [database normalization](docs/database/normalization-report.md)
- [CRM imports](docs/csv-import-normalization.md), [Product normalization](docs/product-normalization-report.md), [Custom Fields](docs/custom-fields.md)
- [Shared CRM record views, history and synchronization](docs/crm-record-detail-ui.md)
- [Forms verification](docs/forms-production-report.md), [Campaign email delivery](docs/campaign-email-delivery.md)
- [Engagement and Deal creation](docs/engagement-deal-creation.md), [Workflow assignment/history](docs/workflows/workflow-assignment-history.md)
