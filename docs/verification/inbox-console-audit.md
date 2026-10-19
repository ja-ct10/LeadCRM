# Inbox console audit

Audited October 19, 2026, from upstream `main` at
`821f3127145478262173a98d2044ecb7af93e557`, on local branch
`codex/inbox-console-audit`. The previous branch and other checkouts were
preserved. Concurrent Dashboard, CRM, Forms, and email-body flow-containment
changes were preserved and included in the final local verification.

## Attribution

| Message or symptom | Evidence and conclusion |
| --- | --- |
| Screenshot: blocked script execution in `about:srcdoc` | This is a Chrome sandbox security message, not a JavaScript exception identifying its initiator. The original signed-in Chrome profile and affected production conversation were unavailable; the last browser inventory reported local browser use disabled in Work settings. Its exact source, deployed revision, and extension involvement remain unverified. |
| Same sandbox message during local investigation | Reproduced in extension-disabled Chrome in a plain HTML iframe with no React or LeadCRM components. Native quote toggles were clean before inspection; the iframe inspection sequence produced twelve sandbox messages after two toggles. The saved comparison is linked below. This establishes test-inspection interference, not attribution of the original screenshot to an extension. |
| `ResizeObserver loop completed with undelivered notifications.` | Separately reproduced during Inbox content/CID replacement with parent-only inspection and no blocked-script messages. The frame wrote height during resize delivery and retained the previous document's observer/listeners until the next load. Deferring height writes alone did not eliminate the error. Deferring writes and cleaning up on source changes eliminated the reproduced error. |
| Aborted image requests | Leaving a conversation or replacing its document can cancel an outstanding image request. The browser report retains these `net::ERR_ABORTED` entries separately from unexpected failures. Unchanged parent renders caused no new frame loads, content reads, or attachment reads. |
| PWA `beforeinstallprompt` notice in screenshot | The existing provider intentionally defers the browser prompt for its Install button. Its installation/listener tests pass. No installation code was changed or live installation attempted. |

The original screenshot is **not classified as extension-generated**. A
normal-profile versus extension-disabled comparison of that same authenticated
conversation is still required for production attribution. Local fixture results
do not establish live Gmail or deployed-app acceptance.

## Focused implementation

- `frontend/src/features/tenant/inbox/ui/email-html-frame.tsx`: coalesce initial,
  image-load, quote-toggle, and resize measurements into a parent-window animation
  frame. Cancel queued work and disconnect the old observer/listeners when
  `srcDoc` changes, as well as on reload/unmount. Preserve height calculation,
  bounds, iframe identity, and source generation.
- `frontend/src/features/tenant/inbox/ui/email-html-frame.test.tsx`: three
  regressions cover deferred/coalesced measurement, height growth/shrinkage,
  reload/unmount cleanup, source-change cleanup, and stable unchanged source.
- `backend/scripts/preview-inbox-deal-conversations.mjs`: extend the existing
  simulated Gmail fixture with console/security logging, lifecycle accounting,
  hostile HTML, images, attachments, navigation cycles, and separate inspection
  and blocked-script controls. Application checks read email DOM through the
  parent; Chrome captures screenshots directly. No application logging is hidden.
- This report records evidence and limitations.

No dependencies, renderer replacement, API/schema changes, or production
configuration changes were introduced. The concurrent `display:flow-root` change
in `email-html.ts` belongs to the separate spacing task and was preserved.

## Security and behavior

The exact sandbox remains
`allow-same-origin allow-popups allow-popups-to-escape-sandbox`, without
`allow-scripts`. DOMPurify configuration, `script-src 'none'`, the remaining CSP,
unsafe-URL filtering, no-referrer image requests, and attachment authorization
remain intact. Email markup is never inserted into the main application DOM.

The browser audit verifies plain text, styled HTML, tables, remote/CID logos,
safe links, and script/event-handler removal. A separate deliberate script
insertion produces the expected security message while both the parent and email
execution markers remain unset.

Repeated parent renders keep frame loads and service reads unchanged. Each open
body has one observer and two document listeners; closing releases frames,
observers, listeners, and Blob resources. Content recovery/CID resolution may
legitimately replace the document; opening another message legitimately creates
another frame. Neither is an unchanged-content remount.

PDF preview receives the original PDF Blob, and downloaded bytes match the
two-page provider fixture. Image preview loads the original raster image with
`object-fit: contain`. Authorization is tested separately against a disposable
database and simulated Gmail. No live attachment was accessed or real email sent.

## Verification

- Frontend: **141 tests passed in 11 suites**, including all existing Inbox
  suites, the new frame regressions, shared Files attachment tests, and PWA tests.
- Backend: **156 scoped mailbox integration tests passed**, using a fresh PGlite
  database and simulated Gmail, including attachment and authorization cases.
- `npm run lint -- --concurrency=1`: passed all three workspaces, including
  frontend TypeScript and backend test typechecks.
- Frontend production build: passed with exit zero; generated **180 pages**.
- Isolated browser: **14 width/theme flows plus the blocked-script control
  passed**. Widths: 320, 375, 390, 430, 768, 1024, 1440px, in Light and Dark.
- Fresh Chrome with extensions explicitly disabled: **the same 14 flows plus
  the blocked-script control passed** on Chrome 155.0.8059.80 / Playwright 1.62.1.
  Ordinary application flows had zero console/security errors and zero unexpected
  request failures. Fifteen cancelled image requests remain recorded. The plain
  iframe control produced zero sandbox messages without inspection and twelve
  after inspection; the deliberate script insertion produced one expected message.
- Scenarios include list-only Inbox, multiple replies, expansion/collapse,
  conversation switching, repeated open/close, navigation away/back, refresh,
  PDF/image preview, byte-preserving download, responsive layout, hostile markup,
  and listener/resource cleanup. Mobile email and desktop preview screenshots
  were visually inspected.
- Final scoped diff and whitespace checks passed. Unrelated edits remain in place.

Initial sandbox runs could not reach loopback browser/database servers or Google
Fonts. The same checks passed outside those restrictions. Development-only Vite
configuration and reduced-motion notices remain; no application change was made
to suppress them. Expected sandbox messages occur in the labelled security and
inspection controls, not the successful ordinary application flows.

Reproduction commands:

```powershell
npm --prefix frontend run test -- src/features/tenant/inbox src/shared/components/crm/record-files-tab.test.tsx src/shared/components/__tests__/pwa-install.test.tsx --maxWorkers=1 --pool=threads
node backend/scripts/test-mailbox-db.mjs scoped-mailbox.integration.test.ts
node backend/scripts/preview-inbox-deal-conversations.mjs --console-audit
node backend/scripts/preview-inbox-deal-conversations.mjs --console-audit --clean-chrome
npm run lint -- --concurrency=1
$env:API_URL='https://leadcrm-build.example/api/v1'
$env:LEADCRM_QA_BUILD_ASSETS='1'
$env:NEXT_PUBLIC_USE_MOCK_AUTH='false'
$env:NEXT_PUBLIC_USE_MOCK_DATA='false'
npm --prefix frontend run build
```

The existing preview also supports `--width=320` for a focused reproduction and
`--production` to compare the fixture without development tooling. Neither option
changes application builds or security policy. Generated evidence remains under
the already ignored preview output directory.

Evidence:

- [Isolated browser results](../../data/outputs/inbox-deal-conversations-browser/console-isolated/results.json)
- [Extension-disabled Chrome results](../../data/outputs/inbox-deal-conversations-browser/console-clean-chrome/results.json)
- [Standalone inspection comparison](../../data/outputs/inbox-deal-conversations-browser/inspection-control.json)
- [Frontend tests](../../data/outputs/inbox-deal-conversations-browser/frontend-tests.log)
- [Mailbox/attachment tests](../../data/outputs/inbox-deal-conversations-browser/attachment-tests.log)
- [Lint/typechecks](../../data/outputs/inbox-deal-conversations-browser/lint.log)
- [Production build](../../data/outputs/inbox-deal-conversations-browser/frontend-build.log)

No deployment, production migration, publication, or live Gmail mutation was
performed. The remaining acceptance item is attribution and live regression
verification in the original authenticated Chrome profile.
