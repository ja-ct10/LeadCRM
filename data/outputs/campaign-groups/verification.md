# LeadCRM campaign, roles, and groups verification

Verification completed locally on October 4, 2026. Deployment was not performed as part of this verification.

1. **Campaign Report files changed.**
   - [Report UI](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/features/tenant/marketing/campaigns/ui/campaign-report-view.tsx>)
   - [Campaign page integration and Create Campaign action](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/features/tenant/marketing/campaigns/ui/campaigns-page.tsx>)
   - [Frontend campaign API adapter](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/shared/services/campaigns.api.ts>)
   - [Frontend campaign type](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/store/types/campaign.types.ts>)
   - [Shared campaign report contract](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/shared/src/contracts/campaign.contract.ts>)
   - [Report controller](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/marketing/campaigns/campaigns.controller.ts>)
   - [Report repository](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/marketing/campaigns/campaigns.repository.ts>)
   - [Report aggregation](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/marketing/campaigns/campaigns.service.ts>)
   - [Brevo click URL/event persistence](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/marketing/campaigns/brevo-webhook.ts>)
   - [Shared date/time formatter](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/shared/components/data-grid/cell-renderers.tsx>)
   - [Report component tests](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/features/tenant/marketing/campaigns/ui/__tests__/campaign-report-view.test.tsx>) and [campaign API integration tests](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts>).
2. **Old report sections removed.** Removed Engagement Overview, Device Breakdown, the old Sent Overview, oversized metric panels, and obsolete metric-tab state. The report now follows the requested order: back link, dynamic badges/title/subtitle, five metrics, details, recipients, and compact clicked links.
3. **Existing components reused.** Card, Badge, Button, AvatarCell, DataGrid and its skeleton/empty/scroll behavior, DataLoadingSkeleton, ModuleTableToolbar, ModuleSearchInput, RefreshButton, DropdownMenu, RecordBackButton, CreateActionDropdown, Dialog, ConfirmActionDialog, useConfirmDialog, Sonner toast, and existing date formatting. Role skeletons compose the existing pulse styling in the existing role card shape; no new skeleton framework or duplicate report components.
4. **Recipient filters.** All recipients, Delivered, Bounced, Opened, and Clicked filter actual report records. Search and status use an AND combination.
5. **Recipient search.** Case-insensitive, trimmed name/email search over the complete recipient records returned by the report endpoint. Empty results distinguish no recipients from no matching recipients.
6. **Refresh.** One report request refreshes totals, recipient activity, and links together. The existing refresh button shows progress; in-flight requests are guarded and already loaded rows remain visible. Initial skeletons, recoverable errors, and refresh errors are visible.
7. **Date formatting.** Shared `formatDateTime` composes existing `formatDate` with an en-US hour/minute value in the viewer's local timezone. Missing/invalid dates display an em dash. Browser verification used Asia/Manila.
8. **Top Links behavior.** The backend aggregates stored HTTP(S) click URLs, distinct recipient emails, total click events, recipient-based click rate, and latest click timestamp. New Brevo callbacks retain URLs and distinct repeated clicks while deduplicating retries. The table uses actual URLs; unavailable link titles are not invented. No clicks produces a compact empty state. The webhook fields were checked against [Brevo's transactional webhook documentation](https://developers.brevo.com/docs/transactional-webhooks).
9. **Create Campaign button.** Reuses the same CreateActionDropdown used for Contacts, using its primary-action-only branch. It has no dropdown arrow and keeps the existing campaign builder action.
10. **Roles skeleton loader.** [Roles & Permissions](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/features/tenant/settings/ui/roles-permissions.tsx>) now retains the page header/banner and shows card-shaped placeholders for icon, name, badge, description, actions, user count, and permissions count. Loaded cards, retryable errors, and the empty state remain functional.
11. **Groups skeleton loader.** [Groups UI](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/features/tenant/settings/ui/team-management-groups.tsx>) uses the existing row skeleton. Refresh retains loaded rows and indicates activity.
12. **Groups Filter removal.** Removed the filter control; Search and Refresh remain, with New Group in the existing top action area.
13. **New Group validation.** Red required asterisk, native required semantics, connected field errors, and shared trim/minimum/maximum validation. Empty and whitespace-only names fail on both frontend and backend. Zero-member creation remains allowed. See [shared group validation/contracts](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/shared/src/contracts/group.contract.ts>), [backend DTO](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/administration/groups/groups.dto.ts>), and [group service](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/administration/groups/groups.service.ts>).
14. **Success toasts.** The existing Sonner system now shows exactly: “Group created successfully.”, “Member added successfully.”, “Member removed successfully.”, and “Group deleted successfully.” Meaningful API errors remain visible. Partial membership-add failures preserve the already-created group and allow retrying failed additions.
15. **Remove Member confirmation.** Existing confirmation dialog identifies the member; Cancel makes no removal request. Confirming updates membership/counts and shows the requested success toast.
16. **Delete Group confirmation.** Empty-group deletion uses the existing destructive confirmation dialog and the requested title, explanation, and buttons. The API runs only after confirmation.
17. **Backend non-empty group protection.** [Group repository](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/src/modules/administration/groups/groups.repository.ts>) deletes only when actual membership rows are absent, within a serializable transaction. Member addition also uses a serializable transaction and an idempotent unique-key upsert. Non-empty deletion returns 409 with the requested explanation. Tenant checks and RBAC are preserved; foreign-tenant additions fail.
18. **Group member search.** Reuses ModuleSearchInput. Searches first name, last name, full name, email, and role, case-insensitively. The source is the complete membership response already provided by the existing Groups API, not the potentially incomplete tenant-user list. The [frontend Groups API](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/shared/services/groups.api.ts>) reuses shared contracts.
19. **Responsive fixes and checks.** Verified 1440px desktop, 768px tablet, 390px, 375px, and 320px. Metrics wrap; details stack; toolbars wrap; both report tables scroll inside their containers; role footer values wrap; group tabs/actions and dialogs remain usable. Automated checks found no page-level horizontal overflow. Screenshots cover the report, list button, role skeleton/cards, group skeleton/list/members, and creation/removal/deletion dialogs.
20. **Accessibility.** Added meaningful icon-button and table-region labels, retained refresh tooltip/label, required-field semantics and error association, hidden decorative skeleton content, and existing confirmation focus trapping. The shared [Dialog](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/frontend/src/shared/components/ui/dialog.tsx>) now offers optional focus trapping, enabled only for group forms. Browser checks exercise Tab and Shift+Tab containment.
21. **Tests actually executed.**
   - Focused frontend Vitest command below: **4 files / 33 tests passed**.
   - [Disposable database test runner](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/backend/scripts/test-campaign-groups.mjs>): **28 campaign + 3 group integration tests passed** against actual Express routes and fresh in-memory PostgreSQL-compatible PGlite databases with repository migrations. Includes actual report aggregation, repeat-click/retry handling, group validation/CRUD, duplicate membership, non-empty deletion, tenant isolation, and RBAC.
   - [Browser verification script](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/scripts/verify-campaign-groups.cjs>): **66 browser/layout checks passed**, with zero browser page errors. Uses the real Next frontend and proxy with a local HTTP fixture server; no production data is changed. This is separate from the real backend/database integration tests.
   - [Machine-readable browser results](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/data/outputs/campaign-groups/results.json>); [desktop report screenshot](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/data/outputs/campaign-groups/campaign-report-1440.png>); [320px recipient section](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/data/outputs/campaign-groups/recipient-performance-320.png>); [320px New Group modal](<C:/Users/Julie Ann Tiron/Desktop/LeadCRM/data/outputs/campaign-groups/new-group-modal-320.png>).
22. **Build/typecheck/lint actually executed.**
   - `npm run lint`: passed in all three workspaces. These repository scripts run `tsc --noEmit`; this was not an additional ESLint run.
   - `npm run build`: passed for backend and frontend, including Prisma generation, backend compilation, Next compilation/type validation, and static-page generation.
   - `git diff --check`: passed. Git emits Windows line-ending normalization warnings.
   - Initial build attempts hit a Windows Prisma engine lock and sandbox file-access error. The successful rerun used the granted build permission.
   - Non-blocking existing warnings remain: Next workspace-root inference from multiple lockfiles, local API URL fallback during build, and Vite's future config-loader warning.
23. **Remaining issues and verification limits.** No known failures remain in the targeted local checks. Deployment, the live tenant's production records, and receipt of fresh real-provider callbacks were not tested: **I cannot confirm this.** Browser viewport tests use desktop Chrome emulation rather than physical devices. Historical click URLs that were never stored cannot be reconstructed by this change; those campaigns can show a clicked-recipient count with an empty links section. Simultaneous membership-add/delete stress testing against a production PostgreSQL server was not executed: **I cannot confirm this.** Database protection was verified against existing membership rows.

## Commands used

```powershell
npm --prefix frontend run test -- src/features/tenant/marketing/campaigns/ui/__tests__/campaign-report-view.test.tsx src/features/tenant/marketing/campaigns/ui/__tests__/campaigns-page.test.tsx src/features/tenant/settings/ui/__tests__/team-management-groups.test.tsx src/features/tenant/settings/ui/__tests__/roles-permissions.test.tsx
node backend/scripts/test-campaign-groups.mjs
node scripts/verify-campaign-groups.cjs
npm run lint
npm run build
git diff --check
```

The browser script expects the frontend on localhost:3108 with `API_URL=http://127.0.0.1:4108/api/v1`, mock authentication/data disabled, and installed Chrome plus Playwright. It supplies a disposable HTTP fixture server on port 4108 and local QA authentication. It resolves Playwright from the workspace, `PLAYWRIGHT_NODE_PATH`, or the installed Codex runtime.
