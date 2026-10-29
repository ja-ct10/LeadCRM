# Activity Timeline role visibility

Verified locally on 2026-10-29. No production deployment, migration, real mailbox connection, or provider send was performed.

## Root cause and resulting behavior

Activity email filters, Deal email matching, and message-body hydration all required the viewer's own `authorizedMailbox`. Client Admin therefore could not retrieve another employee's stored email history, even when the CRM record was visible. The shared frontend reader also reported personal Gmail connection errors for those history reads.

CRM history now has a separate server-resolved read scope:

- **Client Admin:** canonical stored activities throughout the current tenant, without a personal Gmail connection or creator/assignee restriction.
- **Designated Group Head:** activities belonging to records assigned to themselves or members of Groups they head, intersected with existing CRM and Task grants. Membership in another Group does not grant management access. A role named Sales Admin without a Head designation retains ordinary mailbox access.
- **Other staff:** existing CRM assignment, module, and personal mailbox restrictions.

Lists, counts, search, cursors, direct IDs, and relationship previews share the policy. Email bodies use the canonical Activity-to-MailboxMessage foreign key and explicit tenant predicates; metadata cannot substitute a message ID. Elevated Deal reads use saved Activity Deal links, and converted Lead history remains available in Contact timelines. Stored history remains readable by authorized administrators and Heads after the source mailbox is disconnected.

Access and content revisions, plus the current role/Group policy, are rechecked during reads. Changed list/preview authorization returns `409 MAILBOX_SCOPE_CHANGED` without stale data, totals, or cursors; revoked direct IDs return not found. The frontend clears cached rows and pagination on Group changes, including while hidden. Personal Gmail connection errors and subscriptions remain relevant to ordinary mailbox readers; elevated readers use existing CRM refresh behavior.

Inbox access, sending, synchronization, assignment/mutation grants, tenant isolation, and the database schema are unchanged. The existing `/crm/record-access` response adds optional `activityReadScope`; team user IDs remain private. See [API reference](../API.md).

## Changed files

| Area | Files |
| --- | --- |
| Trusted actor and public policy | `backend/src/modules/crm/access/crm-record-access.service.ts`, `backend/src/api/routes/crm.routes.ts`, `shared/src/contracts/crm-record-access.ts` |
| Activity authorization and canonical hydration | `backend/src/modules/crm/activities/activity-read-access.ts`, `backend/src/modules/crm/activities/activities.repository.ts`, `backend/src/modules/crm/activities/activities.service.ts` |
| Relationship previews | `backend/src/modules/crm/relationships/relationships.service.ts` |
| Shared frontend reader | `frontend/src/shared/hooks/use-record-activities.ts` |
| Backend regressions and real database/API fixtures | `backend/src/modules/crm/activities/email-activity-visibility.test.ts`, `backend/src/modules/crm/activities/activity-role-visibility.integration.test.ts` |
| Frontend regressions | `frontend/src/shared/hooks/__tests__/record-activities.integration.test.tsx`, `frontend/src/shared/components/crm/crm-record-view.realtime.test.tsx` |
| Optional browser acceptance | `backend/scripts/activity-role-browser-fixture.mjs` |
| Documentation | `docs/API.md`, this report |

## Executed verification

| Check | Result |
| --- | --- |
| Activity visibility/search and existing mailbox-scope unit suites | 34 tests passed across 3 files |
| New authenticated role suite with optional Chromium acceptance | 12 tests passed, no skipped tests |
| Existing record-history integration suite | 5 tests passed |
| Frontend activity reader and realtime record views, final rerun | 58 tests passed across 2 files |
| Shared Timeline, email rendering, and panel migration suites | 254 tests passed across 3 files |
| Backend lint, including configured test typecheck | Passed |
| Frontend TypeScript lint | Passed |
| Shared build and generated JavaScript synchronization | Passed; the interface-only addition required no JavaScript changes |
| Browser helper syntax and final whitespace/diff check | Passed |

The broader frontend run initially exposed a realtime fixture that did not provide the newly consumed server policy. Its ordinary-mailbox policy mock was corrected; the affected realtime suite and activity-reader suite then passed the 58-test rerun. The other three suites passed in the broader run. Sandbox temporary-file rename restrictions required running Vitest outside the sandbox.

The new database suite replays committed migrations into disposable PGlite and installs the real product, tenant, and CRM authorization middleware. It verifies administrator reads without Gmail; multiple headed Groups and self-assignment; unrelated membership; missing/limited grants; cross-tenant denial; original Sales Agent mailbox restrictions; disconnected source mailboxes; canonical IDs; conversion history; separate Deals sharing a Contact; search and cursor totals; and concurrent changes to Head designation, membership, assignment, and permissions.

Browser acceptance uses real application/API reads and persisted authenticated sessions for Client Admin, Group Head/Sales Admin, and Sales Agent. All three roles passed Deal, Lead, and Contact panel checks for sent/received emails, expansion, and server search. A tenth check switched the same browser from administrator to Group Head and verified unrelated-team history disappeared. No browser JavaScript errors were recorded. Background event streams are stubbed in this browser fixture; realtime stream behavior is covered by the frontend suites.

Browser evidence: `data/outputs/activity-role-visibility/results.json` and nine role/panel screenshots. To repeat the optional browser case, set `LEADCRM_ACTIVITY_BROWSER=true` and run the new role integration file with backend Vitest. Chrome and the local Playwright package are required.

## Remaining limits

Production-role login, live Gmail delivery/synchronization, and deployment were not performed. Browser sessions were issued through the existing authentication/session service in the disposable fixture rather than entering production credentials. No known failing checks remain in the verified scope.
