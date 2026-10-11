# Campaign Send controls implementation report

Local verification: October 11, 2026. No release, remote push, Coolify deployment, or real provider message was performed.

## 1. Root cause and previous Delivery architecture

The header called `save(true)` and read the form's `deliveryMode` state to choose sending or scheduling. A native `datetime-local` field supplied scheduling time. Removing that selector without refactoring the operation would leave the header dependent on hidden, stale state. The builder now accepts explicit `draft`, `send`, or `schedule` intent; a schedule additionally requires the selected Manila wall time.

## 2. Files modified for this request

- `frontend/src/features/tenant/marketing/campaigns/ui/campaign-builder.tsx`: Send menu, schedule dialog, explicit intent, strict conversion, retry/error/loading handling, and shared rescheduling picker.
- `frontend/src/features/tenant/marketing/campaigns/ui/__tests__/campaign-builder.test.tsx`: updated immediate-send interactions and new menu, scheduling, cancellation, error, duplicate, delayed-save, rescheduling and SMS tests.
- `backend/src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts`: two authenticated schedule/persistence/authorization regressions. Test traffic uses a higher bounded rate-limit budget; the production limiter remains unchanged.
- This report.

Earlier variable, field visibility, audience and shared search changes are retained. No production schema, worker, endpoint, permission, Task or Inbox implementation was changed for this request. Ignored `.tmp` helpers were used for isolated build verification and cached font transport.

## 3. Delivery controls removed

The main form contains no Delivery selector, Schedule Once field, `datetime-local` input, or old polling helper. These nodes were removed. The later user request also removed “Sends once after the due time, within the scheduler's processing interval.” from the modal. Its absence was checked in component tests and at every requested browser width.

## 4. Existing Create Lead design and components reused

The actual `CreateActionDropdown` in `module-workspace.tsx` was inspected. The Send control uses the existing primary `Button`, chevron rotation, right alignment, 192px menu, rounded border/shadow and compact icon/text rows. Behavior uses the existing `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent` and `DropdownMenuItem`, which provide a portal, viewport placement, arrow-key navigation, outside click, Escape and focus restoration. No second menu framework was introduced.

## 5. Send button and menu

The header remains Save Draft | Send chevron | Preview Toggle. The default Send button has no leading Send icon and only opens the menu. Its two entries are Send Now with `Send`, and Schedule Send with `CalendarClock`. The immediate-send pending label remains “Sending...”; submission permissions and locking remain effective. Opening either the menu or picker performs no Campaign mutation.

## 6. Shared ManilaDateTimePicker

The existing picker is mounted in the existing portal-backed `Dialog` with a linked title and description. It includes the existing calendar and Hour/Minute/AM-PM selects plus Cancel/Done. Campaigns explicitly pass `rollPastToday={false}`. A fresh picker session on each opening handles even rapid close/reopen during the dialog's exit animation. No calendar library or shared picker behavior was changed.

## 7. Cancel, Done and failures

Cancel, Escape and dialog dismissal close without creating, updating, sending or scheduling a Campaign. Form and audience values remain. Existing modal interaction restores focus and background scrolling. Done validates the selected time and existing Campaign form/variables, then saves through the existing create/update API and calls the existing schedule API. Authoritative audience eligibility and provider configuration checks remain on the server.

If saving succeeds and scheduling fails, the message says “Campaign draft saved, but scheduling failed.” followed by the actual error. The overlay, selected time, body and saved ID remain for retry. Retry updates the same draft; it never falls back to immediate send. Successful scheduling closes the dialog and follows the existing navigation behavior. Canceled temporary picker edits are discarded; a prior valid selection submitted for a failed request is retained.

## 8. Date, time and timezone validation

`manilaLocalDateTime` formats stored and initial values. `manilaTaskDueInstant` converts the selected minute to UTC, including calendar round-trip validation. Campaigns additionally require the exact date-and-minute shape and apply `CampaignScheduleSchema`, which rejects instants at or before the current time. Validation runs on Done and again after draft persistence immediately before the schedule API. Reopening an elapsed selection initializes a new future Manila minute. Past dates are disabled, elapsed time today disables Done, and Campaign time never rolls to tomorrow.

The component test with a frozen clock proves October 12, 2026 3:59 PM Manila becomes `2026-10-12T07:59:00.000Z`. A separate backend test persists an offset timestamp and verifies the exact UTC instant. The production path computes the user's value and contains no fixed scheduling date.

## 9. Immediate Send backend reuse

Send Now retains the existing draft create/update, `campaignsApi.send`, background status polling and authoritative submitted/failed/interrupted feedback. Email body preparation, SMS footer/length behavior, variable validation, saved-draft sending without edit permission, and failed-send ID recovery remain covered by tests. Provider acceptance continues to be distinct from actual delivery.

## 10. One-time scheduling backend reuse

Done calls the existing `PATCH /marketing/campaigns/:id/schedule`; no new route or Delivery database field was added. `scheduledFor`, approved content/rule snapshots, worker polling/claim/recovery, provider boundaries, reporting, suppression and unsubscribe handling remain intact. The server rejects past timestamps and enforces `campaigns.send` and tenant scope. Delivery remains subject to the existing scheduler, irrespective of the removed explanatory text.

## 11. Existing scheduled Campaign management

Scheduled content and audience controls remain locked, as do Save Draft and the immediate Send trigger. The persisted Manila schedule is displayed. Reschedule opens the same picker and calls the same schedule API without creating or updating content. Cancel schedule retains the existing API and returns the Campaign to Draft without deleting it. Component and disposable-database tests verify reschedule, cancellation, retained content, schedule snapshot stability and cancellation/worker races.

## 12. Duplicate submission protection

The synchronous request lock protects draft creation, Send Now, Done, reschedule and cancellation. Pending scheduling disables the entire picker fieldset, Cancel/Done, editor and conflicting header actions, preventing changes or dismissal while the submitted selection is in use. Double-click tests verify one create/send or schedule operation. Backend tests also verify duplicate schedule retry uses the same Campaign, concurrent workers claim once and due dispatch is not repeated.

## 13. Task and Inbox regression results

Task editor/data tests and Inbox composer scheduling tests passed unchanged. A browser check opened Create Task, selected an elapsed time today, and observed the existing next-occurrence value tomorrow with Done enabled; Cancel created no Task. Campaigns instead showed the future-time error with Done disabled and no next-occurrence message.

The local Inbox displays “Connect work email” because the isolated fixture has no connected Gmail account. Inbox cancel, future UTC queueing, retry identity and strict no-rollover behavior passed controlled component tests. Live authenticated Gmail scheduling is unverified: I cannot confirm this.

## 14. Responsive and browser evidence

At 320, 375, 390, 430, 768, 1024, 1440 and 1920px (800px height), the header controls, two-item menu and modal fit the viewport. Every Hour/Minute/AM-PM/Cancel/Done control fit the dialog; no document or dialog horizontal overflow was observed. Modal focus and body scroll lock were verified at all widths. A 320x480 check verified internal scrolling and keyboard access to Done. Arrow-key menu movement, Escape, outside click, focus restoration, dialog focus wrap and month navigation were also checked.

Evidence directory:
`C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a129a0-5887-7450-851b-046725b221bc/campaign-send-controls`

It contains `responsive-evidence.json`, `short-screen-evidence.json`, screenshots at every width, Task regression evidence, the Inbox connection boundary and `schedule-send-final.png`. Browser Cancel checks left only the two pre-existing preview Campaigns and made no real send.

## 15. Automated acceptance results

Final focused frontend run: **87/87 passed across six files**, including **32 Campaign builder tests**, Campaign page/picker, Task editor/data and Inbox composer scheduling. Backend disposable PostgreSQL/authenticated HTTP run: **65/65 passed**. Real Email/SMS transports were mocked in integration tests; no provider message was delivered.

| Acceptance | Evidence and result |
| --- | --- |
| A–D: removed controls, header, exact menu, opening without mutation | Component tests and browser checks passed |
| E: immediate send | Component/provider feedback and backend controlled transport tests passed |
| F–H: shared picker, past date/time and no rollover | Component and browser checks passed |
| I–J: future today/date and exact persistence | Component UTC payload and backend timestamp/persistence tests passed |
| K: Cancel | Component no-mutation/focus/content and browser checks passed |
| L: failure/retry | Actual mocked server error retained value/content/ID; retry same draft passed |
| M: duplicates | Pending/double-click component and backend concurrent-claim/retry tests passed |
| N: scheduled management | Locked editor, reschedule, cancel and database retention tests passed |
| O: Task | Regression tests and browser next-occurrence check passed |
| P: Inbox | Component regressions passed; live Gmail browser acceptance unavailable |
| Q: Email/SMS | Component scheduling and backend controlled-provider dispatch tests passed; real providers unverified |
| R: responsive | All eight widths plus short-screen scrolling passed |

Executed commands:

```text
npm --prefix frontend run test -- src/features/tenant/marketing/campaigns/ui/__tests__/campaign-builder.test.tsx src/features/tenant/marketing/campaigns/ui/__tests__/campaign-variable-picker.test.tsx src/features/tenant/marketing/campaigns/ui/__tests__/campaigns-page.test.tsx src/features/tenant/inbox/ui/compose-schedule.test.tsx src/features/tenant/operations/tasks/__tests__/task-editor.test.tsx src/features/tenant/operations/tasks/__tests__/task-data.test.tsx
node backend/scripts/test-campaign-groups.mjs src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts
```

Sandbox cache/socket failures were rerun through approved normal Windows access. The expanded HTTP suite initially exhausted the product five-request budget from one test IP; its fixture now retains the limiter with a higher bounded test budget. This does not verify the production rate limiter's threshold. The focused passing runs do not represent the full repository test suite.

## 16. Types, lint and builds

`npm run lint` (the repository's TypeScript no-emit checks) passed for all three workspaces. Backend production TypeScript emission also passed. `git diff --check` passed for the changed implementation/tests.

The ordinary combined build encountered the active preview's Windows Prisma DLL lock; ordinary frontend builds also failed on Google Fonts DNS/timeout errors. Verification then used two isolated measures without changing product configuration:

- Frontend production build: process-only HTTPS build URL plus Next's build-only Google Fonts response fixture, reusing the actual twelve cached Poppins WOFF2 files from the local preview. No substitute font bytes or product font/layout change was made. The build generated all 180 pages.
- Backend production build: copied current backend/shared sources into an ignored directory, generated a private Prisma client with the already installed generator, then ran production TypeScript compilation and copied startup code. Only the temporary generator launch/output location differed; no database was accessed or preview data reset.
- Shared package build: `npm --prefix shared run build` passed using the existing TypeScript/generated-file workflow.

These verify local compilation/artifacts. They do not prove the ordinary combined command will succeed while the preview holds its DLL, or that production Google Fonts access is healthy.

An overlapping standalone type check initially raced the production build's regeneration of `.next/types` and reported missing generated files. The final standalone check was rerun after the build completed; no source workaround was introduced.

## 17. Coolify deployment

No deployment was authorized or performed. Frontend/backend live revisions, actual scheduled provider submission and live delivery/reporting were not tested. Production sign-off is withheld.

## 18. Remaining limitations

The change is locally implemented and verified with the stated component, database, browser and compilation evidence. Real Brevo/TextBee delivery, connected Gmail scheduling, production worker timing and authenticated multi-user production acceptance remain unverified. I cannot confirm this. The local preview continues with its existing in-memory data and disabled provider sending; temporary build/fixture artifacts are ignored. No real Campaign or historical data was deleted, and no schema migration or new backend endpoint was introduced.
