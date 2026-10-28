# Lead source attribution and demo

## Disposable local preview

Run `npm run dev:isolated -- --source-demo` for a separate local demo with a
password-protected PostgreSQL database, normal login, sample source-attributed
Leads and a published form. The launcher prints the ignored credentials file at
`.env.local-development/source-demo/LOGIN.txt`. It uses ports 3000 (frontend),
4000 (API) and 55435 (database), with no hosted database or provider credentials.
The email review queue includes one explicitly labeled synthetic inquiry; the
real Gmail mailbox is disconnected. Records survive launcher restarts.

Stop it using `npm run dev:isolated -- --source-demo --stop`. The existing default
local profile is kept separate. Use `--skip-build` only when the backend already
matches the current source.

Form links and QR codes capture sources when a visitor submits. They do not prove
that a real advertisement was served. A QR code is a way to open the same link;
scanning it alone creates no Lead. Unknown acquisition evidence stays unattributed.

## Setup

1. Deploy matching shared, backend and frontend code after applying the additive
   `20261229000000_source_attribution` migration. Preserve the existing encryption key.
2. Backend `APP_URL` must be the public frontend origin. If Forms use another
   origin, set backend `PUBLIC_FORM_ORIGIN` and frontend `NEXT_PUBLIC_FORM_ORIGIN`
   to that same public origin. Never distribute localhost URLs to other devices.
3. In Settings -> Forms, enable Track URL Parameters, then publish. Open Share to copy
   category links or download the table with QR codes. Use a stable campaign name.
4. Embedding support is retained for a later development phase. Embed controls and
   website-origin instructions are intentionally absent from the UI. Existing origin
   settings, the generator and the embed script remain compatible and are preserved
   when saving other settings. Direct forms offer a separate 30-day remember checkbox.
5. Test each link using a clean browser context and a distinct test identity. Confirm
   the Lead source, Details attribution panel, persisted submission and related Deal.

For the current public demo, use `https://lead-crm.tech` as the frontend and Forms
origin, and register
`https://api.lead-crm.tech/api/v1/integrations/business-email/callback` for business
email OAuth. The verified published form is
`https://lead-crm.tech/forms/11c34df6-51f7-4141-9df6-e5a36db8eef0`.

Raw source/medium remain available even when they do not match a predefined
category. Paid Social requires an explicit campaign medium; a Facebook referrer
or `fbclid` alone cannot establish paid advertising. Plain Website captures with
no acquisition evidence show Direct / Unattributed in the attribution detail.
Returning inquiries retain the original first touch and snapshot the new inquiry's
attribution on its Deals. Direct returns do not erase a known qualifying source.

## Direct Email

Business email is a separate admin-managed, read-only Gmail connection for
`goldenbits.1993@gmail.com`; employee mailbox ownership rules remain unchanged.
In Google Cloud, enable Gmail API, configure OAuth and register the exact backend
`/api/v1/integrations/business-email/callback` URI. Set `BUSINESS_EMAIL_REDIRECT_URI`
to that URI; the existing Gmail OAuth client ID/secret and encryption key are reused.
The mailbox owner must approve Google consent from Inbox -> Business email inquiries.

For an invite-only demo, add the owner as a Google OAuth test user. Testing-mode
Gmail refresh tokens can expire after seven days; verify the connection shortly
before the demo and reconnect when necessary. Do not purchase verification,
hosting, advertising, subscriptions or any other service for this work.

New messages after connection are polled in bounded pages every 30 seconds under
normal load. Check for inquiries also performs a manual sync. Spam, trash, sent,
automated/list messages and internal staff senders are excluded. A provider outage
or expired authorization must show a sync error; no successful capture is fabricated.
Messages become review items, not automatic purchase-intent claims. The admin can
dismiss a message or complete the existing Lead form to create a Direct Email Lead.
Message receipts and reviewed actions are idempotent. Existing people are reused
where safe; ambiguous, archived or Contact identities require review.

## Calls and SMS

Staff create the Lead, select Others and enter Call or SMS in Source detail.
These are manual records. No phone link, SMS gateway, call integration or payment
is required. Existing required Lead details still apply; do not invent customer data.

## CRM panel presentation

Lead and Contact forms show Status on its own row and paired Product Category /
Product Interest controls underneath. Deal forms use the same pair in their existing
section. The category control filters available options; changing it never clears
selected products. The repeated read-only category summary is removed from these
forms. Configured labels, visibility, values and historical product identities remain
unchanged. Other selector consumers retain the default stacked presentation.

## Interfaces

- Public submission: optional `attribution` context alongside existing UTM tracking.
- Form Settings: `allowedEmbedOrigins` for validated parent-window messages.
- Lead writes/reads: `sourceDetail`; Lead, Contact, Deal and submission history retain attribution.
- `GET /marketing/forms/:id/source-links[.pdf]`: published, tracking-enabled form links; Forms View required.
- `/integrations/business-email`: admin-only connection status/authorize/disconnect,
  sync and paginated review queue. Review-to-Lead also requires Leads Create.

## Verification

Run `node scripts/verify-source-attribution.mjs` with native PostgreSQL available.
It creates disposable fixtures and never reads provider credentials. Run
`node scripts/preview-source-attribution.mjs` after the backend build for real
API/database browser screenshots on local ports 3300/4300. Its PDF is explicitly
a local preview and must not be distributed as a public link copy.

Rehearse the deployed form from a separate device before distributing the final
PDF. Check each HTTP destination, decoded QR target, actual form submission,
record persistence and access restrictions. For email, send from an external
account and verify capture plus review after the owner connects the mailbox.

`node scripts/export-source-links.mjs <published-form-url>` makes the shareable
PDF under `output/pdf/` after checking every public destination and rendering the
form in Chrome. It only reads the public form; it never submits an inquiry.
Its verification JSON distinguishes reachable links from live capture verification.
`scripts/verify-source-links-pdf.py` independently checks PDF annotations and QR
targets using `pypdf` and `zxing-cpp`. Local screenshots are synthetic fixtures;
they are not evidence that the production release or mailbox connection is complete.

Google's [UTM guidance](https://support.google.com/analytics/answer/10917952),
[Gmail authorization](https://developers.google.com/workspace/gmail/api/auth/web-server)
and [OAuth token lifecycle](https://developers.google.com/identity/protocols/oauth2)
describe the external setup and browser/provider limits.
