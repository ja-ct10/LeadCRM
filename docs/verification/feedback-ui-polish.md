# Global feedback and Campaign preview verification

The implementation reuses Sonner, ConfirmActionDialog, Dialog, ThemeScope and the existing appearance store. No API contracts, backend operations, database schema, permission checks, brand assets, logo components or sent-email templates were changed.

## Shared standards

- All existing frontend toast imports use one adapter backed by the existing Sonner store. Success/info default to 4 seconds, warning/error to 8 seconds and action-bearing messages to 12 seconds; explicit durations, loading IDs, dismissal and persistent update notices remain supported.
- Toasts use opaque accent-tinted card surfaces, semantic status icons, responsive widths and 12px stack spacing. At the user's follow-up request, the original fixed top-right position is restored with Sonner's default 24px desktop and 16px mobile offsets; headers and toolbars no longer move the notifications. Long text wraps, excessive content scrolls within the viewport, and action/close controls retain keyboard focus styling.
- Unexpected transport/database details receive friendly fallback wording. Field and confirmation errors stay inline; duplicate permission toasts were removed from the shared confirmation.
- Dialog titles/descriptions are associated automatically. Explicit accessible names and IDs take precedence. Existing pending locks, cancellation, scroll locking and focus behavior remain in place.

## Workflow audit matrix

| Area | Actions and feedback owner | Confirmation / progress / outcome handling |
| --- | --- | --- |
| Leads, Contacts, Accounts | Existing list/forms and canonical record views own create/edit/archive results; shared file/field helpers own their actions | Existing archive/merge/conversion guards retained; field failures remain inline with their input; upload and delete await actual results |
| Deals and Pipeline | Existing Deal actions, stage dialogs, closing requirements and Pipeline handlers | Existing governed transitions/closing validation retained; no changes to statuses, associations, handoffs or permissions |
| CRM imports | Existing review, import and details flows | Existing review validation, progress/resume identity and result summaries retained; no automatic resubmission added |
| CSV export and Reports | Export controls own request/result feedback | Busy lock retained; completion says the download started, without claiming the browser saved a file |
| Tasks | Editor/details own create, save, complete and archive feedback; board owns bulk summaries | Existing archive confirmation, immutable creator/access checks, conflict handling and failed selections retained; partial archive no longer emits a misleading all-success toast |
| Workflows | Builder/list own save, validate, activate/pause, duplicate and archive feedback | Builder publication confirmation retained with specific labels; list activation/resumption now confirms consequences; confirmation failures stay inline; a post-write refresh failure does not report the write as failed |
| Forms | Builder/list own save, duplicate, publish/unpublish and delete feedback | Publishing/unpublishing now confirms public availability changes; existing deletion/unsaved navigation guards retained; failed operations preserve the form; duplicate and unpublished results are concise |
| Campaigns | Builder/list own draft, send, schedule, duplicate, archive and template feedback | Send Now validates before confirmation and performs no write on cancellation; pending lock and real provider counts/statuses retained; interrupted/uncertain submissions are never automatically retried |
| Campaign email preview | Preview document helper owns presentation only | Explicit light/dark background, text, link and border colors respond to appearance; sandbox, sanitization, variables and desktop/mobile layout retained; saved/sent body remains independent |
| Inbox / Gmail | Mailbox, conversation/list and composer own connection, message and draft actions | Disconnect and nonempty-draft deletion confirm; failures retain content and allow retry; single-recipient Send remains direct; Trash labels describe the existing Gmail operation; existing inline draft-save/progress and partial-provider safeguards retained |
| Notifications | Shared notification hooks/watchers own results; deletion dialog owns its error | Delete errors are inline without a duplicate toast; result IDs and authenticated-scope deduplication retained; SMS progress is informational, while partial/unconfirmed results remain warnings |
| Appearance | Existing appearance store applies preferences immediately | Removed the toast-only Apply Changes button; inline status explains automatic application on this device |
| Profile / organization / security | Existing forms own save/recovery/avatar feedback | Existing validation and pending controls retained; messages use shared durations, styling and concise copy |
| Users / Groups / roles / Products / fields | Existing management forms and confirmation handlers own outcomes | Existing access-changing and destructive confirmations retained; failed custom-field deletion stays open; category errors remain beside the editor; deactivation review uses a specific action label |
| Archived Data | Existing implementation retained at the user's explicit follow-up request | Original Delete labels, icon, confirmations, local behavior and Restore flow preserved. Only the shared toast import changes |
| Authentication / session / Help / shell | Existing auth forms, lockout/session dialogs and shared utilities | Sign-in errors use the existing inline error region without a duplicate toast; recovery/lockout rules unchanged; no new Help navigation feedback added; meaningful persistent app-update notice retained |

## Verification

Baseline planning checks: 136 appearance, shared confirmation and Campaign builder tests passed with Vitest's thread pool. The fork pool's temporary-file rename fails under the Windows sandbox, so verification uses `--pool=threads`.

Behavioral tests cover cancellation without writes, duplicate submission, failed confirmations staying open, retained drafts, submitted versus delivered counts, partial results, notification ownership, toast defaults, accessible dialog names and preview/sent-content separation.

The browser fixture uses actual shared production components and CSS with in-memory actions. It contains no API connection or provider sends. Its runner checks 1440×900 and 390×844 viewports, Light/Dark with Blue/Purple/Orange, Classic/System smoke cases, consecutive/long notifications, drawer confirmations and logo preservation. Screenshots and measured bounds are written under `data/outputs/feedback-ui-verification`.

### Final results

- `npm run lint`: all three workspaces pass.
- Implementation build before upstream synchronization: `npm run build` passes in all three workspaces; the frontend generated all 180 pages. Build validation supplies only a process-local reserved example `API_URL`; no deployment configuration was edited and no live backend was contacted.
- Full frontend suite: 3,047 tests across 235 files were exercised. The initial run had 11 failures in six affected files during the implementation. All six files are included in the subsequent passing regression run: **884 tests across 36 files**.
- Final supplemental checks: **51 tests across five files pass**, covering team administration, SMS progress, appearance, modal behavior and toast defaults. The complete 235-file suite was not repeated after these corrections; its six failing files were all reverified in the passing regression run.
- Browser checks: **12 Light/Dark × Blue/Purple/Orange × desktop/mobile combinations pass**, with Classic/System smoke cases, long descriptions, rapid stacks, action controls, drawer cancellation and failed confirmations. Active toast bounds fit the viewport with no horizontal overflow and at least 10px measured separation after transitions. Minimum measured toast title contrast is **11.78:1**. No browser script errors were recorded.
- Preview iframe widths measured 662px on the desktop fixture and 324px on mobile. Both modes render the expected body background and foreground; personalization, image markup and outgoing-body separation have unit coverage. Existing brand components/assets have no diff.
- `git diff --check` passes. Existing unrelated setup documentation and prior verification outputs were preserved.
- Before pushing, the task commit was reconciled with the latest upstream changes. CSV export availability/cache safeguards and the added Inbox Deal/no-Deal grouping coverage were preserved. Workspace lint and **145 focused tests across ten files pass** on the reconciled commit. The unrelated setup-document edit was restored with an identical file hash and excluded from the commit.
- Toast-position follow-up: frontend TypeScript and all three shared toast tests pass. The browser fixture passes all 12 theme/accent/viewport combinations again, including long messages and modal checks, with no script errors. Measured top/right offsets match the original 24px desktop and 16px mobile placement. The runner dismisses notifications before accessing fixture controls beneath them.

Artifacts: `data/outputs/feedback-ui-tests.json`, `feedback-ui-regressions.json`, `feedback-ui-final-checks.log`, `feedback-ui-build.log`, `feedback-ui-lint.log`, and `feedback-ui-verification/results.json` plus screenshots. Reproduce browser verification with `node scripts/verify-feedback-ui.mjs`; it bundles the real shared UI/CSS into an offline page. `--reuse-bundle` is available only for rerunning assertions against that existing fixture bundle.

Windows sandbox restrictions required approved execution outside the sandbox for native build tools and Chrome. A lint attempt concurrent with Next regeneration saw missing generated route types; the final successful lint ran after the build. Existing React test `act(...)` warnings remain in some unrelated provider suites. Production deployment and real email/SMS/OAuth behavior are outside these local checks.
