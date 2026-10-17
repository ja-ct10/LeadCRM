# Outbound SMS through TextBee

Campaigns and the existing Workflow `send_sms` action use the shared backend
`sendSms()` service. TextBee is the only SMS transport. The service posts one
normalized E.164 recipient per request to
`https://api.textbee.dev/api/v1/gateway/send-sms` with `x-api-key` authentication.
Its registered Android gateway sends through its SIM; API acceptance is not
proof of handset delivery.

## Configuration

Set backend-only `TEXTBEE_API_KEY`, optional `TEXTBEE_DEVICE_ID` (otherwise the
TextBee default device), and `TEXTBEE_WEBHOOK_SECRET`. Empty placeholders live in
`backend/.env.example`; actual values belong in ignored `backend/.env` and the
Coolify backend environment. Never put them in public frontend variables.

Keep the Android gateway enabled, online, permitted to send SMS, and equipped
with an active SIM. Provider account/plan and carrier limits still apply.
An offline gateway can leave accepted messages queued. Do not resend an
uncertain submission without checking provider history.

Configure an active webhook to the backend's HTTPS
`/api/v1/webhooks/textbee` endpoint, using the same signing secret (at least 20
characters). Subscribe only to `MESSAGE_SENT`, `MESSAGE_DELIVERED`,
`MESSAGE_FAILED`, and `UNKNOWN_STATE`. LeadCRM does not process inbound SMS.

## Message construction

`buildFinalSms()` is shared by campaign preflight, live preview and the transport.
It renders allowed campaign variables and trims outer whitespace. New blank SMS
campaigns start with the editable `SMS_DEFAULT_FOOTER` contact/no-reply text in
their body. Authors can edit or delete it, or use **Insert default SMS footer** to
add the original text once. Explicit template content and existing drafts,
including empty bodies, are preserved. Email and SMS retain separate in-progress
bodies; unsaved changes in either body remain guarded when switching channels.
SMS workflow message editors offer the same insertion control on request.
The API, scheduler and transport never add or restore a footer. SMS delivery does
not depend on an organization email address; an email variable appears only if
the author explicitly adds `{{sender_email}}`. Templates store editable content.
Draft edits, copies and scheduling use the authored body. Scheduled content must
be cancelled back to Draft before editing. Cancelling retains its body; scheduling
again approves that current text. Submission freezes the approved personalized
message with the existing tracking links. Previously sent content is preserved.

The preview includes the complete personalized sample, character count,
and GSM-7/Unicode segment estimates.
TextBee's documented segmentation is 160/153 GSM septets and 70/67 UTF-16 units;
GSM extension characters consume two septets. The 50,000-character bound is a
LeadCRM safety limit, not a documented TextBee maximum. Nothing is truncated.

## Persistence and delivery tracking

The existing phone audience rules, normalized-phone deduplication, Contact over
Lead precedence, tenant isolation and campaign claim/locking remain in place.
Provider HTTP calls happen after the preparation transaction commits.
`CampaignContact.phone` stores the phone; `messageId` stores the one-recipient
`smsBatchId`. Accepted sends are submitted, not delivered. Responses without an
authoritative batch identifier and timeouts are marked unconfirmed for review;
the service never blindly retries them. Workflow submission receipts remain in
their existing execution steps.

Webhook authentication is HMAC-SHA256 of the exact raw request bytes, compared
in constant time against `X-Signature`. Delivery updates require matching batch,
recipient, provider message and the device frozen for that submission. The additive
`20261107000000_textbee_webhook_receipts` migration stores provider idempotency
keys with a composite tenant/recipient foreign key. Repeated events do not
inflate counts. Nonfinal states cannot replace a final delivered/failed state;
conflicting final states use event timestamps and require review. A callback
arriving before the submission receipt gets a retryable 503.

Reports distinguish submitted, sent, delivered, failed and pending.
`UNKNOWN_STATE` retains verified Sent evidence in the campaign, recipient report
and summary. Without Sent evidence it remains Pending/unconfirmed. SMS never fabricates opened/clicked activity. Webhook
metrics are recomputed from persisted recipients. Existing Email history remains
intact. Historical UniSMS callbacks are no longer processed after the switch.

The forward `20261205000000_sms_campaign_outcomes` migration adds the frozen
device/sender and bounded verification schedule. It preserves existing receipts
and notification history. Verified outcomes produce durable notifications for
eligible creator/sender recipients through the existing notification outbox and
deletion-safe delivery ledger. Submitted is an immediate info toast; Sent,
Delivered, Failed, partial failure and unconfirmed outcomes have separate
deduplicated toasts while the application is open. Refresh does not replay old
completion toasts. General notification preferences and current access apply.

The shared notification watcher polls every 2.5 seconds only for relevant SMS
activity within five minutes of submission, then every 30 seconds. It shares
requests across consumers, pauses while hidden and backs off on errors. SMS
reports use the same bounded fast window and refresh on new outcome notices.

Accepted batches with no final report can be checked through the read-only
TextBee batch endpoint. At most ten due recipients are claimed each minute;
subsequent checks back off to 5, 15 and 60 minutes and expire after 30 days.
Identity checks and campaign locks protect concurrent callbacks. No lookup sends
or resends a message. Missing delivery reports leave verified Sent unchanged.
SMS submissions use a rolling pool of at most five HTTP calls; the 15-second
timeout and durable submission intent/receipt safeguards remain in place.

## Validation and controlled release check

Run SMS service tests, disposable campaign tests, Workflow SMS integration tests,
campaign composer/report tests, Prisma validate/generate, shared/backend/frontend
typechecks, both builds, rollout tests and `git diff --check`.

Validate the forward migration and native PostgreSQL SMS regression suites with
`node backend/scripts/test-sms-tracking-postgres.mjs` (set `POSTGRES_TEST_BIN` to
the local PostgreSQL bin directory where required).

Only with separate approval, deploy the verified commit and additive migration
through Coolify, then verify
the serving commit through the frontend proxy. Use only an approved isolated
test recipient for one SMS. Confirm its provider batch, signed status callbacks,
persisted recipient status and actual receipt. Ask the recipient to verify the
entered message and its links.
Do not infer receipt or tapping behavior from API acceptance.

## SMS campaign links and conflicting provider evidence

New SMS campaigns replace valid HTTP/HTTPS destinations with opaque, per-recipient
`APP_URL/s/:token` links after personalization. The preview opens the original
destinations and counts the sent URL lengths with sample tokens; the server checks the
actual final SMS length transactionally before provider submission. `APP_URL`
must be the public website origin, using HTTPS in production. The frontend's
existing server-only `API_URL` forwards these public redirects without CRM
cookies or authorization. No extra service, subscription, or credential is needed.

Forward migration `20261216000000_sms_campaign_links` adds the empty link table and
nullable tracking metadata without modifying historical SMS. Deploy matching
backend/shared/frontend builds after that migration; old SMS links remain
untracked and cannot gain historical clicks. Keep this public route reachable
when adding ingress authentication or caching rules. Do not cache its redirects.
Make the new frontend route available before enabling sends from the updated
backend, or pause Campaign sending during the coordinated rollout. Otherwise a
new SMS could contain a link that the old frontend cannot serve yet.

Each recipient counts once per campaign and once per destination. Repeated visits
retain visit totals separately. HEAD and known preview/crawler requests redirect
without counting; unidentified automation can still count. SMS opens remain
unavailable. SMS Engagement/Click rate uses unique clicking recipients divided by
SMS submissions. Total Clicked includes email and tracked SMS; Total Opened remains
email-only. Clicks never infer Sent or Delivered and never trigger another send.

Signed callback receipts retain status and event time, without message content.
Conflicting Delivered/Failed facts set a review flag in list, report and CSV. A
strictly later event timestamp can replace a conflicting terminal result; absent
or equal timestamps retain the current result for review. Receipt arrival time
does not determine the outcome. Existing historical receipts have no reconstructed
event metadata. The CRM cannot repair an inconsistent TextBee dashboard.

Run `npm run test:integration:native -- --filter=campaigns.integration,sms-tracking.integration,sms-links.integration`
for isolated PostgreSQL/API coverage. Frontend campaign/route/export tests cover
channel-specific metrics, provider warnings and public redirect forwarding. The
existing `scripts/campaign-status-preview.cjs` accepts `SMS_LINK_PREVIEW=1` and
`CAMPAIGN_PREVIEW_PORT` for UI-only verification with no database/provider calls.

## Official references

- [Sending SMS](https://textbee.dev/docs/sending-sms/sending-sms)
- [API reference](https://textbee.dev/docs/api-reference)
- [Webhook authentication and retries](https://textbee.dev/docs/webhooks)
- [Outbound events](https://textbee.dev/docs/webhooks/events)
- [API keys](https://textbee.dev/docs/getting-started/api-keys)

These contracts were checked on 2026-10-07. TextBee's dashboard may omit
`UNKNOWN_STATE` in its event picker; its documented webhook PATCH API supports it.
