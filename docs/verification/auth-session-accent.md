# Logout, inactivity, Remember Me and accent verification

## Root causes and changes

- Manual sign-out entries invoked authentication directly. They now share one UI coordinator using the existing `useConfirmDialog`, `ConfirmActionDialog` and dirty-editor navigation guard. Cancel makes no logout request. Confirmation waits for revocation, clears authentication and permission caches, and explicitly navigates to Login, including from public Help. Failed revocation remains retryable; pending confirmation and authentication calls are deduplicated.
- Remember Me already controlled the secure cookie's persistence, but had no remembered identifier preference. Successful checked login now stores only the normalized email. Login restores the email and checkbox; unchecking removes the preference immediately. Logout and expiry preserve that preference while ending authentication. Password fields retain browser password-manager autocomplete and are never persisted by the application.
- The existing server-side 30-minute inactivity policy remains authoritative. A conditional activity-write race previously could return stale session data after a concurrent revocation; it now revalidates. Activity cannot move backwards, enter the future, or revive an expired session. Protected 401 responses, authorization-stream expiry and browser timers clear stale authentication consistently. Cleanup and idle redirection do not wait for network recovery.
- Tab messages previously identified only the user, and late transport events could affect a later login. Opaque session IDs now correlate logout/activity and peer messages; an ID mismatch returns `409 SESSION_CHANGED` without revoking or clearing a replacement session. Transport lifecycle counters discard stale authentication events. No JWT or credential is exposed to JavaScript by this change.
- The native Login checkbox had text/focus classes but no native `accent-color`, allowing the browser/OS accent to appear red. Login now uses the existing reusable Checkbox. Native checkboxes/radios inherit the existing appearance store's accent; functional blue selection/focus overrides in reusable controls now use semantic tokens. Primary hover fills use the configured hover token. Teal, green and orange fills were deepened to maintain at least 4.5:1 contrast with white text. Existing dark text contrast handling, visible focus, theme scopes, persisted preferences, destructive/status colors and customer-authored form palettes are retained.

Authentication, cookie signing, tenant isolation, RBAC and the shared appearance store remain the existing implementations. No database migration or dependency addition is required. See [authentication](../authentication.md) and [API contracts](../API.md).

## Automated verification

Initial focused runs cover **181 frontend tests in 16 files**, **83 backend regression tests in 6 files**, and **4 session HTTP integration tests**, all passing. Overlapping reruns are counted once, using the latest result for each file.

Frontend coverage includes Login/Remember Me, invalid and failed login, logout cancellation/error/retry/double-click, public Help redirection, dirty-editor guards, first-login routing, auth restoration and stale responses, inactivity/wake/cross-tab handling, blocked browser storage, API auth events, reusable confirmations/checkboxes, appearance persistence/prepaint/portals, compiled CSS and all seven accent fill/hover contrast checks.

Backend coverage includes existing login/account/session revocation and middleware regressions, idle boundaries and concurrency, passive maintenance reads, and authorization-stream reasons. The new focused HTTP suite uses a disposable PGlite Session table and real Prisma queries, signed JWTs, middleware, controllers, validation and cookies. Account lookup and password verification are fixture boundaries; existing login service tests cover that separate implementation. It verifies session versus seven-day HttpOnly cookies, explicit revocation and cleared cookies, protected denial after logout, passive reads at 29 minutes, denial and no renewal at 30 minutes, valid activity, invalid dates and replacement-session protection.

Commands use `npm --prefix frontend test -- <target files> --pool=threads --maxWorkers=1 --hookTimeout=60000` and `npm --prefix backend test -- <target files> --pool=threads --maxWorkers=1`. HTTP fixtures require loopback networking. Reports are retained locally under `data/outputs/auth-accent-verification/`.

`npm run lint` passed all three workspaces, including backend test typechecking. `npm run build` passed shared, backend and frontend, including 180 generated static pages. The final patch also passed `git diff --check`.

Merge verification in [PR #203](https://github.com/reymarkjpanes/LeadCRM/pull/203) additionally runs the complete isolated frontend/backend inventory on Ubuntu. Its first frontend run identified isolated password/onboarding fixtures missing the confirmation provider, plus button tests asserting the former inline fill/brightness implementation. The fixtures now mount the production provider; the button tests check semantic accent utilities, and compiled-CSS coverage verifies the configured hover fill. Their existing domain and security assertions are retained. The follow-up local run passed all **206 tests in 10 affected files**, plus frontend typechecking. Full CI results are recorded on the PR.

## Browser verification

Chrome runs against the local production build at 1440 × 1000 with disposable API fixtures and external fonts disabled in the test browser. No live account, provider or deployment is modified. These are frontend browser checks; real server session behavior is verified separately by the HTTP suite above.

| Scenario | Observed result |
| --- | --- |
| Select Purple and Dark, then refresh | Saved selections remain; the primary action uses `rgb(147, 51, 234)` |
| Open manual logout and Cancel | Existing themed confirmation appears; no logout request; session stays active |
| Confirm logout from public Help with a second tab open | Both tabs reach Login; one manual request; email and checked preference restored; password value empty |
| Login page after logout | Reusable checkbox uses the saved purple accent on the public light Login page |
| Uncheck Remember Me and refresh | Saved email is gone and checkbox is unchecked |
| Leave logout confirmation open at 29 minutes | Session and confirmation remain active |
| Reach 30 minutes | Both tabs reach Login with the inactivity notice and without confirmation |
| Connection-recovery Sign out | Shared confirmation appears; Cancel preserves the session; confirmation revokes and reaches Login |

No browser page errors were observed. When two tabs independently receive expiry signals before processing each other's storage event, each can send one idempotent revocation for that same session. Peer-only logout handling sends no extra request; repeated manual confirmation sends one pending request.

## Limits and release attention

The broader pre-existing full-schema `first-login.integration.test.ts` fixture did not finish setup within its local timeout. Its source remains unchanged. The focused real-session HTTP suite and frontend first-login integration tests passed; this report does not claim a full monorepo integration run.

Browser verification uses intercepted disposable APIs and desktop Chrome, so it does not establish live deployment or physical-device/Safari coverage. Deploy matching frontend and backend revisions together, then smoke-test one real account's login, Cancel/confirmed logout, remembered email and saved accent in the target environment.
