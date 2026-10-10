# CRM record views

The Lead, Contact, Account and Deal drawers and full pages share `CrmRecordView`. Routes remain thin; existing record actions, Files, real Task/Deal creation and governed closing requirements use their domain services.

## Details and field configuration

[Customize Fields](custom-fields.md) configures module-specific labels, visibility, groups and ordering using stable system keys and custom field IDs. Details combines native and custom fields in the same saved sections. Staff forms retain their existing input controls and validation while using the same layout. Hidden values remain stored; closing evidence is enforced independently of Details visibility.

Lead conversion references remain stored, while the former Converted contact section is omitted. Lead and Contact headers use the existing Inbox shortcut. Deal relationships display Lead/Contact and Account separately under their respective view permissions.

## Notes, Tasks and Activity Timeline

Activity contains Notes, Tasks and Activity Timeline in that order on all eight surfaces. Saving a note creates one authored `Activity.type=note` for the current record; legacy scalar notes/description are preserved. The draft clears only after success. Save is disabled while pending, and failures retain the draft. Tasks uses the existing real Task editor and contextual list. Historical Timeline keeps filters, search and email-thread grouping; its filters do not affect Notes or Tasks.

Notes and Timeline independently request cursor pages from `GET /crm/activities`. Ordering is `createdAt DESC, id DESC`; Load more fetches older server rows. Contact history reads direct rows and source-Lead rows through the same-tenant conversion relationship. Contact contextual Tasks similarly include direct and inherited associations once per original Task ID, without rewriting links or responsibility. Related Deals use server pages beyond the first 50. See [Task assignment](workflows/task-assignment.md) for Task Owner and Assigned Agent.

## Silent synchronization

The existing scoped cache owns one in-flight read per tenant/user/module/query. Parsed authoritative mutation results update the record cache; coalesced invalidation reconciles active lists and related data. Loaded views remain mounted during background reads, preserving tabs, filters, drafts and scroll. Transient failures retain usable authorized data with retry feedback; authoritative 403/404 and authentication loss clear protected data. Requests and retained history are discarded on identity/cache-generation changes.

One authenticated `/crm/record-events` listener uses `DashboardRevision.content`. Forward-migration triggers increment the tenant counter with committed record, activity, Task, field, file and relationship mutations. Only counters are streamed. Reconnect, focus and online reconciliation use the same cache path; duplicate CRM/Task timers were removed. Existing Auth, Pipeline, Dashboard, Mailbox streams and Campaign status polling remain specialized.

## API and rollout

See [API reference](API.md#record-history-and-synchronization), [Customize Fields](custom-fields.md), and [forward rollout](../README.md#forward-rollout). No Notes table, new cache library, provider sender or replacement form engine was introduced. New database transitions are additive Task creator/Sales metadata, Campaign scheduling, and CRM content revisions.

## Implementation baseline and validation

Implementation started on feature branch `codex/implementation-plan` at current `main` SHA `61f78c39f7dccfa2676a8705d9b6ea2106a1be49`, matching the supplied plan's reviewed baseline. Existing canonical junctions, conversion identity/retry, real Tasks/Files, Inbox routing and Campaign delivery/recovery were retained. Work was divided across field configuration/Details, Task/Sales/Form assignment, Campaign audience/scheduling, and shared record history/cache integration.

Focused tests cover server history beyond 100 events and 50 Deals, inherited/direct deduplication, trimmed authored notes and tenant/RBAC rejection, transaction rollback/revisions, cache concurrency/stale responses/access loss, and shared drawer/page behavior. Isolated migration/HTTP tests use disposable PGlite databases; Campaign providers are mocked.

| Focused verification | Passed checks |
| --- | --- |
| Shared record panels/pages, Timeline, activities, relationships and cache | 91 tests across five frontend suites |
| Custom-field and closing UI, including transient errors and cleared data | 20 tests across two frontend suites |
| Field layout service / isolated custom-field API / Customize Fields UI | 7 / 11 / 10 tests |
| Record history API, pagination, tenant/RBAC, revision rollback and SSE | 5 integration tests |
| Conversion continuity, preservation and retry | 7 integration/property tests |
| Task service and creator/Sales forward migrations | 22 tests |
| Isolated Forms / Tasks / protected Groups API | 20 / 19 / 5 integration tests |
| Task editor and Groups UI / cache, history and Task data | 27 / 42 frontend tests |
| Auth lifecycle and Timeline, including reconnect, transient failures and revocation | 19 frontend tests |
| Campaign audience, personalization, scheduling and mocked delivery | 59 backend tests; 52 frontend tests plus one failed-schedule source-change regression |
| Campaign forward migration on empty and representative existing data | 2 tests |
| Rollout guards / historical migration scripts | 9 / 3 tests |
| Final production browser acceptance with disposable PGlite database and mocked providers | 61 checks: 48 responsive, 8 surface semantics, 5 pagination/synchronization/revocation; zero page, transport or API 5xx errors |

Some suites overlap; these counts should not be added into a unique-test total. The final implementation report records the completed workspace lint/build and browser results. No production migration, deployment, merge or real Email/SMS send is part of this work.
