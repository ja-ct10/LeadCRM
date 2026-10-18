# Campaigns and Workflows follow-up

Continues the interrupted Campaigns/Workflows implementation from “Audit LeadCRM functionality”.

## Behavior

- New blank SMS campaigns start with editable Camxian contact/no-reply text. Authors can change or remove it and insert the default text again on request. Existing drafts, explicit templates, copies and scheduled messages retain their authored body. Email and SMS keep separate in-progress bodies. The shared formatter personalizes entered text and trims outer whitespace without adding or removing a footer. Empty personalized sends fail before recipient reservations or provider calls.
- Email preview, saved drafts and provider HTML use the same sanitized, blue, underlined hyperlinks. Plain HTTP/HTTPS URLs retain queries, fragments and surrounding punctuation. Unresolved variable URLs are linked after personalization.
- SMS remains plain text. Preview links open original destinations; character counts include the existing recipient tracking URL length. Sending retains per-recipient tracking, provider evidence and delivery-state rules. Preview visits do not create tracking clicks.
- Workflow Move Deal Stage can close a Deal as Lost without a reason. The step editor uses Sales Pipeline by default and no longer shows a pipeline dropdown or separate loss-reason controls. Configured custom-field and stage entry requirements still apply. Older configured reasons remain active unless explicitly disabled. Manual Lost transitions retain their reason requirement. Tenant isolation, RBAC, stage entry requirements and execution idempotency remain enforced.
- The chooser has 23 stable starters plus templates generated from configured pipeline stages. Seven additions cover new Deals, Deal reassignment follow-up, stage follow-up email, Won email, Lost follow-up, Lead SMS and Contact template welcome. All remain editable drafts. Reassignment conditions match the actual `event.changedFields` list; generated tasks link to the triggering Deal and use its eligible owner.
- Reduced Campaign composer and Workflow chooser/builder headings. Form input sizes and touch targets remain readable on small screens.

## Supported scope and setup

Inactivity timers, Task due/overdue workflow triggers and Campaign workflow triggers are unavailable. Existing Task assignment/reminder notifications remain in use. No timer or retired notification/campaign action is advertised as a working template.

Use the existing [TextBee configuration](textbee-sms.md), [campaign email configuration](campaign-email-delivery.md) and [Workflow sender rules](API.md). Workflow email needs an eligible assigned agent's authorized Gmail connection. Select an available email template or enter both subject and body. SMS tracking needs the existing public HTTPS `APP_URL` and reachable `/s/:token` route. These changes introduce no additional provider account, subscription, credential or database migration.

## Verification

The baseline below predates the editable-footer follow-up. See
[Editable SMS footer lifecycle](sms-footer-lifecycle.md) for its updated behavior
and focused acceptance results.

Tests use isolated local fixtures and mocked providers. No real email or SMS was sent by these checks.

| Check | Result |
| --- | --- |
| Campaigns and Workflows frontend tests | 494 unique tests passed: the 493-case module run plus the new empty-SMS draft regression; the 102-case composer suite was rerun |
| Automation, Deals, campaign rendering/tracking and SMS transport unit tests | 308 passed |
| Native PostgreSQL integration | 151 passed across Workflow policy (17), Workflow polish (26), Campaign API/persistence (75), SMS links (9) and SMS delivery tracking (24) |
| Campaign variable/message browser journeys | 71 passed; Light/Dark at 320, 375, 390, 430, 768, 1024, 1440 and 1920 pixels |
| Workflow policy/chooser browser journeys | 22 passed; Light/Dark at 320, 375, 768 and 1440 pixels, including optional reasons, template search/preview, visible primary actions, discard behavior and persisted campaign status evidence |
| TypeScript | Shared, backend, frontend and backend tests passed |
| Production builds | Shared, backend and frontend passed; all 180 frontend pages generated |

The 953 unique unit/component/integration tests cover the affected scope. These
results do not represent a fresh audit of every unrelated LeadCRM module or a
production provider delivery test. Received-email appearance and SMS link behavior
in a physical messaging application still depend on that client. No deployment,
payment, subscription change or production database mutation was performed.

The embedded database initially lost its connection during integration testing;
the accepted persistence results above use fresh native PostgreSQL instead.
Browser harness updates account for the mobile preview sheet, workflow insertion
positions, dynamic pipeline templates and the expanded journey count. Visual
review used settled screenshots, including SMS link bounds and the loss-reason
panel. Local logs, JSON reports and screenshots are retained under the ignored
`data/outputs/system-audit/` evidence directories.
