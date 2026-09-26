# Search and Settings UI fixes

## Global Search

Changed `frontend/src/shared/components/global-omnibox.tsx` and
`mobile-search-overlay.tsx`.

- Leads use trimmed `firstName + lastName`, then `leadPerson`, then `displayName`.
  Contacts use trimmed `firstName + lastName`, then `contactPerson`. A single
  component works; absent names show “Unnamed person.” Lead search retains the
  API fields instead of discarding fallback names in the Contact adapter.
- Company/account/customer type and email remain secondary; Accounts retain their
  company name as the primary result.
- A shared selection handler clears the query and result arrays, closes the
  dropdown, removes focus, invokes `onResultSelect`, and navigates. Mobile passes
  `onClose` through that callback. Quick “View/Open” actions use the same handler.
- Existing 300ms debounce, three-character minimum, module scoping and services
  remain. Request generations reject late responses; scope includes current
  tenant/user/environment. Immediate repeat searches work after selection.
- Destinations are `/crm/leads?highlight={id}`, `/crm/contacts?highlight={id}`,
  `/crm/accounts?highlight={id}`, and `/crm/deals?highlight={id}`. The selected
  record is resolved through the existing authenticated detail endpoint and shown
  in the module table with its DataGrid highlight and scrolling. It cannot be
  lost behind a text filter or later page. “Show all records” exits this selection.

Supporting changes: the four CRM `ui/*-page.tsx` files;
`deals/ui/deals-data-grid.tsx`; `leads/hooks/use-leads-data.ts`;
`accounts/hooks/use-accounts.ts`; shared `hooks/use-module-data.ts` and
`services/contacts-v2.api.ts`. Contacts detail requests now accept cancellation.
No endpoint, authentication, RBAC, tenancy or database contract was added.

## Archived Data

Changed `frontend/src/features/tenant/settings/ui/archived-data.tsx`.
Five initial skeleton rows represent type, name, secondary text and Restore,
using `animate-pulse` with reduced-motion support and an accessible loading label.
Existing cached content remains during background refresh/restore. Tabs use the
available width, stay on a single line and scroll horizontally on narrow screens.
The restrictive `max-w-3xl` was removed.

## Client Admin permissions

Changed `frontend/src/features/tenant/settings/ui/roles-permissions.tsx`.
Protected administrator system roles display `allPerms.map(p => p.id)` as their
effective permissions. Individual and group switches are ON, groups show their
full counts, and the header currently shows 39 of 39. The role card agrees.
Switches, name, description and Save remain disabled; the submit handler also
refuses system-role updates. Viewing the role performs no mutation. Custom roles
continue using database permission IDs and their existing editing behavior.

## Team Management

Changed `team-management-users.tsx`, `team-management.tsx` and shared
`components/crm/module-workspace.tsx`.

- Removed Show archived, Export and Invite toolbar controls and the now-unreachable
  invitation modal/export code. Existing pending-invitation management remains.
- Status offers Active/Inactive; departments come from loaded users; role options
  come from non-archived API/DataContext roles, including Client Admin.
- Reuses Leads' `FilterGroupSection`. The filter is a 280px inline rail beside
  the table on desktop and a full-width section above it below 1024px. Closing it
  restores table width. Table headers, row height, borders, hover and internal
  horizontal scrolling follow the existing Leads layout.
- Filtering is client-side over all pages loaded from the real users API. This
  retains the current data flow and supports multi-selection without introducing
  a new endpoint: OR within a group, AND across groups, exact department/role
  matches. Pagination resets when criteria change.
- Existing API loading, retry, empty state, user drawer, editing, archive and
  password-reset behavior remains.

The existing user model stores archive as `status: INACTIVE` and its adapter marks
all inactive users archived. They stay hidden by default; explicitly choosing
Inactive includes them so the filter works with persisted records. Restore stays
in Archived Data. No new archive field or migration was introduced.

## New User

Changed `frontend/src/features/tenant/settings/ui/user-panel.tsx`.
The existing side panel remains. Placeholders are `e.g. Juan`, `e.g. Dela Cruz`,
`e.g. juan.delacruz`, `9xxxxxxxxx`, `Select role`,
`e.g. Sales Representative`, and `e.g. Sales`.

Email is one bordered input group with an editable username and a fixed,
non-editable `@camxian.com` suffix from the shared domain constant. Typing/pasting
`@` is rejected. The local part accepts letters, digits, dots, underscores,
hyphens and plus signs; whitespace inside the username and control characters
are rejected. Surrounding spaces are trimmed. The existing shared email schema
checks full email syntax and lowercases the final payload:
`${username.trim()}@camxian.com`.

The existing `CreateAdministrationUserSchema`/backend `CreateUsersSchema` already
enforces the exact domain and normalization, so no second validator or endpoint
was needed. Tests exercise the server DTO directly. Creation still uses
`usersService.create` → browser `/api/proxy/administration/users` →
`POST /api/v1/administration/users` → service validation → Prisma.

PH-only phone validation, 100-character text limits, trimming, control-character
rejection, red required markers and one error below each field remain. Success
closes the panel, refreshes users/count and toasts; failure preserves input.
No localStorage-backed business data was introduced.

## Executed verification

- Frontend: 47 tests passed across these six files using
  `npm --prefix frontend run test --` followed by their paths:
  - `src/shared/components/__tests__/global-omnibox.test.tsx`
  - `src/features/tenant/settings/ui/__tests__/user-panel.test.tsx`
  - `src/features/tenant/settings/ui/__tests__/roles-permissions.test.tsx`
  - `src/features/tenant/settings/ui/__tests__/archived-data.test.tsx`
  - `src/features/tenant/settings/ui/__tests__/team-management-users.test.tsx`
  - `src/shared/hooks/__tests__/cached-page.integration.test.tsx`
- Backend: 20 tests passed with `npm --prefix backend run test --
  src/modules/administration/users/users-validation.test.ts
  src/core/auth/__tests__/security-validation.test.ts`.
- `npm run lint` passed for all three workspaces.
- `npm run build`: backend passed, including Prisma generation. Frontend initially
  failed on the sandbox's Windows home-directory `readlink` restriction. The
  authorized `npm --prefix frontend run build` retry passed, including type
  checking and generation of all 189 pages. Existing workspace-root and local
  backend-URL configuration warnings remain.
- Browser component fixtures used production components/styles with test-only
  API responses at 320, 375, 768 and 1440px. Users and New User had no page overflow;
  filters stack on narrow widths and sit beside the table on desktop. Archive tabs
  stayed on one scrolling row. Five archive skeletons were visually inspected.
  Search selections closed mobile overlays at 320/375px, cleared desktop inputs
  at 768/1440px, and produced the correct highlight URL. Immediate repeat search
  was verified after fixing the debounce race. Inactive filtering was checked
  against an API-shaped INACTIVE user passed through the real user adapter.
- Final git diff reviewed and `git diff --check` passed.

Browser fixtures do not establish a live database or deployment test. No production
records were changed, no migration was applied, and no live setup email was sent.
