# Gmail attachments in CRM Files

Implemented locally on `codex/crm-email-attachments`, based on verified upstream
`main` at `e3dead29f78f020d03beaa570fcabc9a68638c19`. Date: October 19, 2026.
The original checkout and its unrelated uncommitted source changes are preserved.

This report covers the Gmail Files implementation. The consolidated workspace PR
also includes the existing [Deal Industry retirement](../deal-industry-retirement.md),
CRM product category selectors, and shared role permission table work. It preserves
the newer Deal address behavior from upstream `main` at `ad09b8e5`.

## 1. Files changed

| Area | Files |
| --- | --- |
| Shared contracts | `shared/src/contracts/record-experience.ts` and its generated `.js` |
| Record metadata API | `backend/src/modules/crm/record-files/record-files.routes.ts`, `record-files.service.ts` |
| Gmail authorization and bytes | `backend/src/integrations/gmail/mailbox-record-scope.ts`, `mailbox-attachments.ts`, `gmail.controller.ts` |
| Shared CRM UI | `frontend/src/shared/components/crm/crm-record-view.tsx`, `record-files-tab.tsx` |
| Existing preview extraction | `frontend/src/shared/components/attachment-preview.tsx`, `frontend/src/features/tenant/inbox/ui/email-message-content.tsx` |
| Gmail client | `frontend/src/features/tenant/inbox/services/gmail.service.ts` |
| Focused tests | `backend/src/integrations/gmail/scoped-mailbox.integration.test.ts`, `frontend/src/shared/components/crm/record-files-tab.test.tsx`, `crm-record-view.realtime.test.tsx` |
| Local browser preview | `backend/scripts/preview-record-email-attachments.mjs`, `.gitignore` for generated fixture evidence |
| Documentation | [API reference](../API.md) and this report |

No schema, migration, dependency manifest, storage provider, sending,
synchronization, quotation-generation, or association-writing changes.

## 2. Existing components reused

All three modules retain `CrmRecordView` / `CrmRecordPanel`, `RecordFilesTab`, and
its existing `FileRow`, icons, upload zone, metadata formatting, error/loading
states, and manual actions. Gmail references add optional actions and are read-only.

The Inbox's existing SideSheet/PDF iframe/image preview is extracted into
`AttachmentPreview`; Inbox and CRM Files now render that same component. The
quotation preview and PDF renderer remain unchanged. No PDF library is added.

## 3. Email-to-record associations

- Leads use stored `MailboxMessage.leadId`.
- Contacts include direct `contactId` links and existing converted source Leads.
- Deals require a stored message/Deal link or stored thread/Deal association,
  plus the current canonical customer relationship. A thread selection supersedes
  an older per-message Deal link. Existing saved links are honored, including
  links created by the current ingestion behavior; Files never infers a new one.
- Closed/Won history remains readable under existing access rules. Unrelated
  Deals do not inherit all attachments from their Lead or Contact.

## 4. Metadata retrieval

`GET /crm/{module}/:id/email-attachments` returns metadata references for at most
20 linked messages per page, with an optional continuation cursor. Valid stored
metadata is used first. Empty or incomplete historical metadata is recovered by
the existing authorized `readMailboxContent` operation and Gmail read budget.
Inline body images follow Inbox's exclusion rules.

Only already stored, authorized, record-linked provider message IDs are read.
There is no full-mailbox scan or new worker. Files provides "Load older
attachments" and retains existing rows during pagination. Failed recovery uses
the existing error/retry presentation and never fabricates a file.

## 5. Preview and Download

Each CRM Preview/Download action makes a fresh authenticated request to the
existing Gmail attachment endpoint with CRM context and the expected mailbox ID.
The original bytes are returned with existing type/size checks, safe filenames,
`nosniff`, and `no-store`. PDFs retain the browser viewer and new-tab fallback;
images retain aspect ratio; unsupported formats have Download only.

Blob URLs and in-flight requests are cleared on access/record changes and
unmount. Manual upload/download/delete behavior remains separate and unchanged.
No `RecordFile` row, binary database content, or storage object is created for
a Gmail attachment. Activity records are not created or replayed.

## 6. Duplicate prevention

References use connected account + provider message + attachment/MIME-part
identity. Both metadata and presentation deduplicate by that identity, with
separate React key prefixes for uploads and Gmail. Equal filenames remain
separate when their original identities differ. Conversion does not copy files.

## 7. Security verification

Record View permission, tenant, current record availability, mailbox ownership,
current assignment/participant scope, stored association, and attachment
membership are enforced. Record and message association are rechecked after
provider I/O. CRM visibility or Client Admin status does not grant access to
another employee's mailbox.

Focused verification covers cross-user/tenant denials, invalid Deal links,
association changes during reads, stale mailbox references, disconnection,
revoked provider authorization, unavailable metadata, and unchanged Activities.
Gmail references never expose manual Delete/Archive actions.

## 8. Verification evidence

- Backend: all 149 scoped mailbox integration tests passed against the disposable
  PGlite harness, including preserved Deal uploads, stale mailbox identity,
  provider revocation, conversion, historical recovery, and byte authorization.
- Frontend: 4 focused suites, 65 tests passed, including all three modules in
  actual CRM panels and page components, pagination, events, previews, and Inbox.
- Workspace lint/TypeScript: `npm run lint -- --concurrency=1` passed; final backend
  test typecheck also passed.
- Shared build and generated JavaScript synchronization passed.
- Backend TypeScript compilation with `tsc -p backend/tsconfig.json` passed.
- Frontend production build exited successfully and generated 180 pages. Windows
  reported `EPERM` when tracing the local dependency junction into standalone
  output. Compilation/typechecking passed; standalone packaging is not verified.
- Shared Files browser fixture: 42 combinations passed at 320/375/390/430/768/
  1024/1440px across three module contexts and panel/page widths, with no page
  errors or horizontal overflow. It checks long filenames, a valid two-page PDF,
  original downloaded bytes, fresh reads per action, and image aspect ratio.
- Final diff inspection includes schema/manifests remaining unchanged and
  `git diff --check`.

Reproduction commands:

```powershell
npm --prefix frontend run test -- src/shared/components/crm/record-files-tab.test.tsx src/shared/components/crm/crm-record-view.realtime.test.tsx src/features/tenant/inbox/ui/email-message-content.test.tsx src/features/tenant/inbox/ui/email-conversation-view.test.tsx --maxWorkers=1 --pool=threads
node backend/scripts/test-mailbox-db.mjs scoped-mailbox.integration.test.ts
npm run lint -- --concurrency=1
npm --prefix backend run typecheck:tests
npm --prefix shared run build
node node_modules/typescript/bin/tsc -p backend/tsconfig.json
node backend/scripts/preview-record-email-attachments.mjs
$env:API_URL='https://leadcrm-build.example/api/v1'
$env:NEXT_PUBLIC_USE_MOCK_AUTH='false'
$env:NEXT_PUBLIC_USE_MOCK_DATA='false'
npm --prefix frontend run build
```

Heavy checks ran sequentially after parallel attempts exceeded available local
memory. Tests ran outside the filesystem sandbox after its temporary-file rename
restriction prevented Vitest from starting.

Browser evidence: [results](../../data/outputs/record-email-attachments-browser/results.json),
[320px Files](../../data/outputs/record-email-attachments-browser/files-320.png),
[320px image preview](../../data/outputs/record-email-attachments-browser/image-preview-320.png).

The browser fixture uses the real shared Files UI and production styles with
simulated attachment bytes. Backend tests use a disposable local database and
simulated Gmail; these are not live Gmail or deployed-app acceptance. No real
email was sent, no production data was modified, and no deployment was performed.
