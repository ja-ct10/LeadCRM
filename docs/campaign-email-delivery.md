# Campaign email delivery

Implemented for the existing Campaigns module on 2026-09-24. This describes the implementation and validation performed locally; it is not a production deployment or confirmation of live Brevo delivery.

## Existing transport reused

`backend/src/shared/services/email.service.ts` remains the only Brevo sending implementation. Campaigns call its `sendMail`, which calls `POST https://api.brevo.com/v3/smtp/email` once per recipient. It reads the existing backend variables `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`. No second provider client or API key was added. The browser calls LeadCRM only.

`sendMail` now returns `{ messageId: string | null, submitted: boolean }`. Existing account email callers can continue awaiting it without using the result. A development fallback or allowlist block returns `submitted: false`; it cannot be recorded as a successful campaign submission. Campaign calls require configured delivery. Provider requests have a 15-second timeout and return safe errors without logging the API key, message body, or raw provider response. The hardcoded fallback sender was removed: configure the existing sender variable.

Regression coverage includes registration verification, OTP, password reset, administrative password reset, invitations, welcome-email rendering, and the existing authentication tests. Automated tests mock Brevo; none send real emails.

## API map

Every marketing endpoint below retains authentication, tenant and active-environment context, workspace readiness checks, and the listed RBAC permission. Browser paths go through the existing same-origin `/api/proxy` transport. Controller and service names are qualified by their source file stem; files live under `backend/src/modules/marketing/`.

| Method | Full backend path | Frontend function | Controller | Service | Permission |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/marketing/campaigns` | `campaignsApi.list` | `campaigns.controller.getCampaigns` | `campaigns.service.getCampaigns` | `campaigns.view` |
| GET | `/api/v1/marketing/campaigns/:id` | `campaignsApi.get` | `campaigns.controller.getCampaignById` | `campaigns.service.getCampaignById` | `campaigns.view` |
| GET | `/api/v1/marketing/campaigns/metrics` | `campaignsApi.metrics` | `campaigns.controller.getCampaignMetrics` | `campaigns.service.getCampaignMetrics` | `campaigns.view` |
| POST | `/api/v1/marketing/campaigns` | `campaignsApi.create` | `campaigns.controller.createCampaign` | `campaigns.service.createCampaign` | `campaigns.create` |
| PUT | `/api/v1/marketing/campaigns/:id` | `campaignsApi.update` | `campaigns.controller.updateCampaign` | `campaigns.service.updateCampaign` | `campaigns.edit` |
| PATCH | `/api/v1/marketing/campaigns/:id/send` | `campaignsApi.send` | `campaigns.controller.sendCampaign` | `campaigns.service.queueCampaign` → `prepareCampaign` → `deliverPrepared` → shared `sendMail` | `campaigns.send` |
| PATCH | `/api/v1/marketing/campaigns/:id/archive` | `campaignsApi.archive` | `campaigns.controller.archiveCampaign` | `campaigns.service.archiveCampaign` | `campaigns.delete` |
| GET | `/api/v1/marketing/templates` | `templatesApi.list` | `templates.controller.getTemplates` | `templates.service.getTemplates` | `campaigns.view` |
| GET | `/api/v1/marketing/templates/:id` | `templatesApi.get` | `templates.controller.getTemplateById` | `templates.service.getTemplateById` | `campaigns.view` |
| POST | `/api/v1/marketing/templates` | `templatesApi.create` | `templates.controller.createTemplate` | `templates.service.createTemplate` | `campaigns.create` |
| PUT | `/api/v1/marketing/templates/:id` | `templatesApi.update` | `templates.controller.updateTemplate` | `templates.service.updateTemplate` | `campaigns.edit` |
| PATCH | `/api/v1/marketing/templates/:id/archive` | `templatesApi.archive` | `templates.controller.archiveTemplate` | `templates.service.archiveTemplate` | `campaigns.delete` |
| GET | `/api/v1/marketing/audiences` | `audiencesApi.list` | `audiences.controller.getAudiences` | `audiences.service.getAudiences` | `campaigns.view` |
| POST | `/api/v1/marketing/audiences` | `audiencesApi.create` | `audiences.controller.createAudience` | `audiences.service.createAudience` | `campaigns.create` |
| POST | `/api/v1/marketing/audiences/preview` | `audiencesApi.preview` | `audiences.controller.previewAudience` | `audiences.service.resolveAudience` | `campaigns.view` |
| POST | `/api/v1/webhooks/brevo` | None; Brevo calls it | `brevo-webhook.brevoWebhookRouter` | `brevo-webhook.processBrevoEvent` | Valid configured Bearer token; production HTTPS |

Save Draft uses POST for a new draft and PUT for an existing draft. It never invokes Brevo. Send Now reuses the existing **PATCH** route. It returns HTTP 202 after the snapshot and allowance reservation commit:

```json
{ "success": true, "data": { "campaignId": "...", "eligibleRecipients": 45, "submittedRecipients": 0, "failedRecipients": 0, "status": "SENDING" } }
```

The composer polls GET by ID every two seconds, for up to five minutes, to display the actual submission totals and completion state. A 202 response does not claim that any messages were delivered. Longer sends continue on the backend and their saved status remains available in Campaigns.

## Database and sending behavior

- `Campaign` stores the draft content, selected source/audience, creator, status, eligible recipient count and submission counts. Only DRAFT records may be edited or claimed for sending. Campaigns already sending cannot be archived.
- `TargetAudience` and `TargetAudienceCondition` persist source and AND conditions. `Template` persists reusable subjects and sanitized content. Campaigns, audiences, templates and delivery results have no browser-storage persistence path.
- `CampaignContact` stores eligible and excluded CRM records, normalized email, minimal personalization, CRM reference, delivery status, exclusion/failure reason and Brevo message ID. Optional CRM references use `ON DELETE SET NULL` so deleting the CRM record preserves the snapshot.
- `EmailDeliveryLog` stores pending and resulting submissions with `brevoMessageId`. `EmailEvent` stores deduplicated provider event types; `CampaignMetrics` stores real aggregate snapshots. Audit entries record create/update/archive, submission totals and detected interruptions.
- A transaction claims `DRAFT → SENDING`, checks the entire audience allowance, and commits all snapshots before any provider call. A second claim returns 409. Validation or allowance failures roll the transaction back to DRAFT without sending.
- Provider calls run in groups of at most five. Successful submissions finish as SENT, mixed results as PARTIALLY_SENT, and no confirmed submissions as FAILED. These statuses cannot be reset through the draft update API. Uncertain timeouts are recorded as unconfirmed failures and are never automatically resent.
- `CampaignEmailQuota` reserves the entire eligible count per UTC date, shared across tenants and environments using the backend's Brevo account. `BREVO_DAILY_EMAIL_LIMIT` defaults to 300. Concurrent sends cannot overbook the same allowance. Reservations conservatively include pending, failed and uncertain attempts for that day; authentication emails are excluded. This is a campaign allowance, **not an exact remaining Brevo account quota**. Brevo remains authoritative and may reject requests because other account emails consumed its quota.

The migration is `backend/prisma/migrations/20260924110000_campaign_brevo_delivery/migration.sql`. It adds the fields, statuses, message/event uniqueness constraints and quota table described above. Apply it before running the new backend.

## Audience resolution and safety

Sources are All Leads, All Contacts, All Leads & Contacts, or a saved audience. The backend resolves recipients itself and accepts no browser-provided recipient list. It constructs Prisma predicates from a static switch over validated fields: status, source, company, product interest, assigned agent ID and created date. Supported operators are field-specific; empty conditions explicitly mean all records from the source.

Tenant and environment are always taken from authenticated context. Campaign, template and audience references are checked within that scope. User emails for the tenant are loaded solely as an exclusion set; Users are never a recipient source. Emails are trimmed and lowercased for validation, snapshot storage and comparison, without rewriting the CRM record. Eligible Contacts take priority over duplicate Leads. Staff matches receive `STAFF_EMAIL`.

Missing/invalid email, archived or inactive CRM records, Contact do-not-contact, previous unsubscribes, hard bounces, blocked/spam/invalid-address events and Sandbox exclusions are excluded. Opt-outs also suppress an equivalent email on a Lead. Preview returns actual counts for matched, eligible, missingEmail, invalidEmail, duplicateEmail, staffEmail, unsubscribed, blocked, inactive and sandboxBlocked; it does not expose a recipient list.

CRM SANDBOX campaigns always require an explicit `BREVO_SANDBOX_EMAILS` allowlist, including when Node runs with `NODE_ENV=production`. Empty or absent allowlists allow zero Sandbox recipients. Existing nonproduction transport allowlist behavior also applies.

Frontend and backend share `shared/src/contracts/campaign-email.ts`: strict payload schemas, Unicode names with length/control-character validation, subjects trimmed with a 200-character maximum and no CR/LF, and one canonical registry for the seven existing variables. Templates, composer controls, previews and backend rendering use this registry. Unknown variables resolve to empty strings; arbitrary object properties and expressions cannot resolve. Recipient values are HTML-escaped before insertion.

Backend HTML uses `sanitize-html` before storage and after personalization. It permits a restricted set of formatting/link/image tags and URL schemes; executable elements, SVG, event handlers and unsafe URLs are stripped. Frontend HTML uses DOMPurify and a sandboxed preview iframe. Required input errors are shown below the relevant field, one message per field. Transport errors retain the saved draft and editor content.

Marketing writes/preview share a 30-per-minute limiter per IP, and send attempts have a five-per-minute limiter per IP. The webhook has a separate 1,000-per-minute limiter. These are process-local abuse controls; database state and quota transactions provide cross-process duplicate-send protection.

## Webhook and metrics

Supported events: `request`, `delivered`, `opened`, `unique_opened`, `click`, `soft_bounce`, `hard_bounce`, `blocked`, `spam`, `unsubscribed`, `invalid_email`, `error`, `deferred`.

Authorization requires a separate random `BREVO_WEBHOOK_TOKEN` of at least 32 characters and a matching `Authorization: Bearer ...` header. This is a webhook verification secret, not a second Brevo API key. Production requests require HTTPS. Configure authentication using Brevo's [secured webhook settings](https://developers.brevo.com/docs/secured-webhooks), with events described in its [transactional webhook documentation](https://developers.brevo.com/docs/transactional-webhooks).

The backend validates the payload, finds the stored Brevo message ID and matching recipient email, and derives tenant/environment from that stored record. It does not trust event tenant fields. Unknown records return retryable 503 to handle callbacks arriving before the send response is saved. Event uniqueness is per delivery and normalized event type: repeated opens/clicks count once per recipient. `unique_opened` and `opened` are one metric. Later low-priority events cannot erase an unsubscribe or bounce status.

The canonical route is POST `/api/v1/webhooks/brevo`, as requested for dashboard configuration. The earlier `/api/v1/webhooks/brevo/email` path is retained as a compatible alias; both use the same authentication and handler and are covered by authenticated HTTP tests.

Only confirmed provider acceptance increments submissions. Delivery/open/click/bounce figures come from corresponding events. Before webhooks arrive, delivery/open/click metrics remain zero. The report no longer treats submissions as deliveries or displays a hardcoded 100% sent result. No device or per-link analytics are fabricated.

## Deployment and operational limits

1. Apply the committed migration using the project's production migration command (`npm --prefix backend run db:deploy`) and build/deploy the backend and frontend together. No production migration or deployment was performed during this work.
2. Keep `BREVO_API_KEY`, `BREVO_FROM_EMAIL` and `BREVO_FROM_NAME` on Render. Verify the configured sender in Brevo. Set `BREVO_DAILY_EMAIL_LIMIT=300` (or the intended campaign allowance). Never place the API key in Vercel or a `NEXT_PUBLIC_` variable.
3. For Sandbox tests, configure only intended test addresses in the existing `BREVO_SANDBOX_EMAILS` variable.
4. Configure the webhook token on Render and register `https://<backend-host>/api/v1/webhooks/brevo` in Brevo with the matching Bearer header and required events. Enable the provider's applicable tracking settings for open/click callbacks.
5. Use the existing frontend backend URL configuration to point Vercel's proxy at Render. The local Next build warned that its local backend URL defaults to localhost; that does not inspect or modify Vercel settings.

Dashboard setup check on 2026-09-24: the repository documents `https://leadcrm-backend-os8d.onrender.com`. Its `/health` returned 200, but an empty unauthenticated POST to `/api/v1/webhooks/brevo` returned 404 (`Cannot POST`). The new route therefore was not available on that deployed service at the time of the check. Brevo and Render opened at login pages in the available browser. No webhook or secret was created or changed. Confirm the service in Render and deploy the implementation before activating/testing the Brevo webhook. Use Node 22.13 or newer; the installed sanitizer requires Node 22.12 or newer.

Sending runs in the existing long-running Render Node process after preparation; no durable external worker was added. Closing the browser does not stop it. A caught persistence interruption marks the campaign PAUSED when the database is available. A hard backend restart can leave a campaign SENDING with pending or ambiguous recipients. Review its `CampaignContact`, `EmailDeliveryLog` and provider results before further action. Do not reset it to DRAFT or blindly replay the audience. Automatic restart recovery/retry is intentionally absent because an accepted email cannot be safely undone.

Send Now supports one EMAIL message. SMS and multi-channel drafts remain available. Unimplemented scheduling/drip/trigger composer controls are not presented as working sends; legacy scheduled EMAIL/MULTI_CHANNEL jobs are paused to prevent bypassing the new recipient and Sandbox safeguards. Existing SMS scheduler behavior is unchanged. Browser-only campaign/template archive restoration was removed; no database restore endpoint has been added.

## Verification performed

- Backend: **70 tests passed across nine files**, including real disposable PostgreSQL plus authenticated HTTP flows. Coverage includes Juan/Maria personalization and persistence, staff exclusion, case-insensitive duplicates, atomic double-send, whole-audience quota rollback and concurrent reservations, Sandbox under production Node settings, tenant/environment/RBAC failures, foreign references, partial failures, maximum concurrency of five, preservation after CRM deletion, HTTP 202 followed by persisted completion, webhook authentication/deduplication/suppression, sanitizer/header attacks, transport requests, and account email regressions.
- Frontend: **19 tests passed across two files**: seven real composer interaction tests plus the existing 12-test campaign loading/archive suite. Composer tests cover required errors, draft-only persistence, double clicks, partial-submission feedback, background completion polling, reopening/updating a saved draft, retaining content after send failure and immediately selecting a newly persisted audience. These are component tests with mocked APIs, not a deployed browser test.
- `npm run lint` passed all three workspaces. In this repository, lint runs TypeScript `tsc --noEmit`.
- Prisma generation and schema validation passed. All 57 migrations applied successfully to a new isolated local PostgreSQL database, including this migration. No existing application database was changed.
- `npm --prefix backend run build` passed. `npm --prefix frontend run build` passed, generating 187 routes; the final post-review build also passed.
- Full changed-source review and a Campaign storage/provider-secret search were performed. No Campaign feature uses localStorage/sessionStorage or calls Brevo from frontend code.

Backend test command:

```text
npm --prefix backend test -- src/modules/marketing/campaigns/__tests__ src/shared/services/__tests__ src/core/auth/__tests__/verification.service.test.ts src/core/auth/__tests__/registration-flow.test.ts src/core/auth/__tests__/change-password.service.test.ts src/api/middleware/__tests__/role-authorization.test.ts src/tests/migrations/migration-ordering.test.ts
```

Frontend test command:

```text
npm --prefix frontend test -- src/features/tenant/marketing/campaigns/ui/__tests__/campaign-builder.test.tsx src/features/tenant/marketing/campaigns/hooks/__tests__/use-campaigns-data.test.ts
```

The database integration suite runs only when `DATABASE_URL` points to localhost/127.0.0.1 and a database named `leadcrm_campaign_test_<digits>`; otherwise it is explicitly skipped. It was executed, not skipped, in the run reported here. Brevo calls were mocked throughout. Live inbox delivery and externally registered webhook delivery still require an explicitly authorized test after deployment/configuration.

