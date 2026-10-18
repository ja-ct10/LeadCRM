# Inbox HTML rendering and attachment previews

Verified locally on 2026-10-18. Base: upstream main `e409a7429eb731a9758319721a35d18c202b4923`.
Implementation checkout: `C:/Users/Julie Ann Tiron/.codex/worktrees/inbox-rendering-preview/LeadCRM`, branch `codex/workspace-inbox-fixes`.
The rendering implementation was developed in isolation. The subsequent all-workspace PR request combines it with the pending primary-checkout thread UI changes. All nine registered worktrees were inspected; only these two checkouts had uncommitted edits. Older CRM canonical-group and ownership commits are represented by current upstream commits 0f90d4f2 and 3431fc8a; the Product documentation correction is already present. Source checkouts were not reset.

## 1. Root causes

- Gmail HTML was already retrieved and preferred. The shared Inbox sanitizer removed email CSS, layout attributes, and images, while application typography replaced the remaining presentation.
- Metadata-only synchronization returned an empty attachment array and could overwrite previously stored attachment metadata.
- Authenticated attachment downloads existed, but the Inbox had no preview flow or CID image resolution. Historical messages needed their display fields recovered from Gmail.

## 2. Rendering and isolation

The existing DOMPurify utility now has a display-only configuration. Compose, Forward, Activities, and other consumers retain their stricter existing configuration. Safe email styles, classes, layout attributes, headings, tables, links, branding, signatures, and footers are preserved.

The sanitized complete document is rendered in a script-disabled sandboxed iframe. Same-origin access permits parent-side height measurement; no script permission is granted. A document CSP blocks scripts, forms, nested frames, objects, external stylesheets, connections, media, and fonts. Email CSS remains inside the frame. Images scale within the viewport; wide layouts scroll inside the frame. Structural quoted history remains expandable. Plain text remains escaped in a preformatted fallback.

HTTP(S) images load automatically with no referrer, as requested. CID raster images use authenticated attachment reads and temporary Blob URLs. Untrusted data/blob image URLs and executable markup are removed. Safe external links use a new tab with noopener/noreferrer. DOMPurify validates markup; CSS safety additionally depends on the sandbox and CSP.

## 3. Components and services reused

- Existing EmailDetailView and EmailConversationView, navigation, thread data, actions, and association controls.
- Existing DOMPurify utility and repository iframe pattern.
- Shared SideSheet, Button, Lucide icons, Sonner toast, loading/error patterns, and quotation preview Blob/iframe approach.
- Existing apiClient download/proxy, Gmail OAuth/token reader, Gmail read helper, mailbox authorization, scope rules, and database transaction patterns.

EmailHtmlFrame and EmailMessageContent are small message-body helpers. No replacement Inbox, modal system, mail integration, viewer dependency, storage service, migration, or document conversion was added.

The combined thread UI reuses Badge, DropdownMenu, and Button: compact participant/count headers; older messages collapsed with sender/date/snippet; subject and Reply/Forward actions inside expanded messages; per-topic Archive/Trash menus; CRM links and association controls between body and attachments. It removes the Reply All UI and its unused frontend draft helper. Backend sending, Reply All delivery support, OAuth, and authorization remain unchanged. Manual expansion/collapse survives refresh and history pagination.

## 4. MIME and synchronization

The existing Gmail MIME traversal handles nested alternative/mixed/related parts, prefers eligible HTML, falls back to escaped plain text, excludes file attachments and attached messages from body selection, decodes declared character sets, and retrieves attachment-backed text parts through the existing Gmail reader. Related body selection respects the root Content-ID when specified.

Attachment metadata retains optional Content-ID, disposition, and MIME part locator in the existing JSON field. Missing sizes stay absent. Metadata-only reads leave stored bodies and attachments untouched. Full reads can still represent an actual empty attachment list. No attachment bytes are stored.

## 5. Retrieval and historical recovery

GET /integrations/gmail/messages/:messageId/content fetches original body/attachment metadata once per expanded message mount and repairs only those existing stored display fields. It does not replay CRM or Activity ingestion. Older messages recover without a bulk migration.

The existing attachment endpoint supports Gmail attachment IDs and validated part: locators for original body.data files. Downloads preserve original bytes, safe filenames, the 35 MB limit, no-store, attachment disposition, and nosniff. Only matching PDF/PNG/JPEG/GIF/WebP signatures receive preview content types; unsupported or mismatched types become application/octet-stream.

## 6. Preview behavior

Attachments appear below the body with actual filename, MIME type label, available size, existing icons, Preview where supported, and Download. Referenced inline images are not duplicated as ordinary attachment cards. Raster images have thumbnails and aspect-preserving previews. PDFs use the native browser viewer, page scrolling, Download, and an Open PDF in a new tab fallback. PDF cards use icons because the repository has no compatible PDF thumbnail renderer.

Preview and download use the original Gmail attachment. Quotations are not regenerated. Blob URLs are revoked on PDF preview closure and message unmount/navigation. Authorization failures close the conversation through the existing failure path, abort pending reads, and clear previews.

## 7. Authorization evidence

Backend tests verify the correct connected mailbox token, stored-message authorization before provider calls, attachment/message relationships, original provider identity/thread checks during content recovery and part reads, current participant scope, mailbox ownership/RBAC rechecks, cross-user and cross-tenant denial before provider reads, and reassignment during provider reads. Recovered display fields are not persisted after scope revocation. No Gmail tokens are exposed to the frontend.

## 8. Tests and builds

| Check | Result |
| --- | --- |
| Combined frontend Inbox/API proxy and quotation wizard suites | 152 passed across 10 files (139 + 13) |
| Focused Gmail unit suites, including new MIME tests | 123 passed across 10 files |
| Scoped mailbox integration suite | 140 passed |
| Mailbox integration suite | 34 passed |
| Quotation integration suite | 43 passed |
| Built frontend + compiled backend browser acceptance | 166 checks passed, zero page/transport errors |
| Mailbox worker restart | Passed across three independent worker processes; one simulated send |
| Workspace lint/typechecks, including backend test typecheck | Passed |
| Shared build and backend TypeScript emission | Passed |
| Frontend production build | Passed, exit 0 |
| Full workspace build | Prisma regeneration blocked by an EPERM lock on the shared Windows query-engine DLL |
| Final git diff --check | Passed |

Integration tests used disposable databases and simulated Gmail. The database suites ran before checkout isolation; backend runtime/test files and the shared contract were confirmed byte-identical in the combined checkout. The 152 frontend tests, workspace lint/typechecks, frontend build, and final 166 browser checks ran against the combined source. The build and browser manifests recorded no source changes during their runs; only this report was updated afterward.

The existing generated Prisma client was used for successful backend compilation; no schema changed. The frontend build reported a standalone tracing symlink-copy EPERM warning with the shared dependency junctions. Compilation and the local built Next.js server passed; deployment packaging is not verified.

Browser command: `node scripts/qa-local.mjs browser --filter=verify-mailbox-browser.mjs`.
Browser evidence: `data/outputs/system-audit/1792334905514-6e127e33-6e6b-46e8-b7df-c758feb1bff6/qa-browser.json` and `browser/verify-mailbox-browser/results.json` in that run folder.
Frontend build evidence: `data/outputs/system-audit/1792334706552-fd94a555-2007-4107-b1b2-0541c935e157/qa-build.json`.

## 9. Responsive and regression verification

Chrome acceptance covered 320, 375, 390, 430, 768, 1024, 1440, and 1920 px in Light and Dark themes. Ten UI states were checked for horizontal page overflow, including Inbox, the actual password-reset template, HTML/quoted conversation, plain text, PDF/image previews, associations, composer, and schedule picker. Native PDF page count was two; navigation to page two and byte-for-byte download equality passed. Mobile password-reset and 320px PDF screenshots were visually inspected.

Existing backend suites cover Reply, Reply All delivery, Forward, Archive, Delete, read state, synchronization, draft/source integrity, and quotation sending. Combined frontend tests cover the pending Reply/Forward-only UI, topic menus, compact headers, associations, and retained manual expansion. The browser harness also verified automatic no-referrer remote images, authorized CID images, formatting colors/buttons, hostile markup removal, CSS containment, plain-text escaping, quote expansion, read persistence, Deal association, scheduled sending, and two-tab SSE updates. Chrome internal PDF-viewer resources are allowed only inside this fixture so the native viewer can run; the application security policy was not relaxed.

## 10. Changed files and limitations

Runtime files:

- shared/src/contracts/mailbox.contract.ts
- backend/src/api/routes/integrations.routes.ts
- backend/src/integrations/gmail/gmail.controller.ts
- backend/src/integrations/gmail/gmail.service.ts
- backend/src/integrations/gmail/mailbox-attachments.ts
- backend/src/integrations/gmail/mailbox-sync.service.ts
- frontend/src/features/tenant/inbox/services/email-html.ts
- frontend/src/features/tenant/inbox/services/email-presentation.ts
- frontend/src/features/tenant/inbox/services/gmail.service.ts
- frontend/src/features/tenant/inbox/ui/email-html-frame.tsx (new)
- frontend/src/features/tenant/inbox/ui/email-message-content.tsx (new)
- frontend/src/features/tenant/inbox/ui/email-detail-view.tsx
- frontend/src/features/tenant/inbox/ui/email-conversation-view.tsx
- frontend/src/lib/api/client.ts

Tests/documentation:

- backend/scripts/verify-mailbox-browser.mjs
- backend/src/integrations/gmail/gmail-mime.test.ts (new)
- backend/src/integrations/gmail/scoped-mailbox.integration.test.ts
- frontend/src/features/tenant/inbox/services/email-html.test.ts
- frontend/src/features/tenant/inbox/ui/email-message-content.test.tsx (new)
- frontend/src/features/tenant/inbox/ui/email-conversation-view.test.tsx
- frontend/src/features/tenant/inbox/ui/compose-schedule.test.tsx
- docs/API.md
- docs/verification/inbox-rendering-attachments.md (this report)

No authenticated live Gmail, production deployment, or physical mobile-device acceptance was performed. External images depend on browser mixed-content/network rules; external stylesheets/fonts and executable embedded formats remain blocked. Office documents, SVG, and other unsupported files are download-only. PDF capabilities depend on the browser; the new-tab/download fallback remains available. The existing 35 MB attachment limit remains in force.

No email sending implementation, quotation generator, or email template was edited. No database migration, publication, or deployment was performed.
