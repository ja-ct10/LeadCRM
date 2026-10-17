# Editable SMS footer lifecycle

The Camxian contact and no-reply text is editable SMS content. It is never an
uneditable transport suffix.

| Stage | Behavior |
| --- | --- |
| New blank SMS campaign | Start with the exact default footer in Body. Edit it freely. |
| New campaign from a template | Preserve the supplied template content, including an intentionally absent footer. |
| Insert default SMS footer | Append the original text on request. Disable insertion when that exact block is already present or it would exceed the message limit. |
| Edit or remove | Preview and character/segment counts use the current body. Removal remains removed. |
| Switch Email/SMS | Preserve separate in-progress bodies. SMS defaults do not enter Email. Unsaved edits in either body remain guarded. |
| Save, reopen or duplicate | Persist the selected channel's authored body, including empty drafts. No default is reapplied. Other channel bodies are retained only while editing. |
| Schedule | Approve the saved body using the existing schedule lifecycle. Cancel before editing. Cancellation retains that text; rescheduling approves the current draft. |
| Send | Personalize the saved text and apply existing SMS tracking/length rules. No footer is appended, restored or duplicated by the API, scheduler or transport. |
| Workflow SMS | The same insertion control is available on request; the author edits and saves the SMS action message normally. Email actions do not offer it. |
| Existing/sent records | Their stored message content is preserved. |

No new database field or migration is needed: the existing campaign body, template
content and Workflow SMS message are the canonical editable values. Existing
tenant/permission checks, scheduling claims and provider outcome handling apply.
See [SMS integration](textbee-sms.md) for configuration and delivery evidence.

Verification uses mocked providers, authenticated local APIs and disposable
PostgreSQL. No real messages or production changes are part of these checks.

## Acceptance results

- 114 frontend composer and Workflow SMS editor tests passed.
- 19 SMS formatter/transport tests passed, including explicit insertion, deduplication and edited/removed footer preservation.
- 77 campaign integration cases passed on disposable native PostgreSQL. Authenticated API cases exercise edits, copies, scheduling, cancellation and dispatch with edited and removed footers.
- 71 browser journeys passed, including editable footer text, SMS/email separation, insertion/removal, preview links and message bounds in Light/Dark at 320, 375, 390, 430, 768, 1024, 1440 and 1920 pixels. Page and transport errors were empty; provider sends were zero.
- Shared, backend, frontend and backend-test TypeScript checks passed. The shared compatibility JavaScript was regenerated, and the frontend production build generated all 180 pages.

Local acceptance logs and JSON results are in the ignored
`data/outputs/system-audit/sms-footer-lifecycle/` directory; browser screenshots
and reports are in the corresponding timestamped system-audit run.
