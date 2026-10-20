# LeadCRM roles

Client Admin is the predefined tenant administrator. A valid @camxian.com email is required. The flow is sign in, required password change, required LeadCRM onboarding, then dashboard. Subscription payments never assign administrator permissions.

Client Admin creates custom roles with per-module permissions and explicitly selects one when creating users. No generic User role is automatically assigned. Existing User definitions are retained as editable custom roles. User.role is the primary identity for routing; UserRole links users to RoleDefinition and RolePermission for permissions. Primary assignments and role renames synchronize these representations transactionally.

Retired Guest identities cannot authenticate. Their archived records are retained only for audit and administrator-directed reassignment. See [migration](plans/final-role-model.md) and [authentication](authentication.md).

## CRM tab permissions

Settings → Roles & Permissions uses the existing Additional Permissions column to configure each custom role:

| Module | Tab controls |
| --- | --- |
| Leads | All Leads, My Leads, Active Lead |
| Contacts | All Contacts, My Contacts, Active Contacts |
| Accounts | All Accounts |
| Deals | All Deals, My Deals |

These controls require module View and remain independent of Create, Edit, Archive, Import and pipeline management. Disabling All does not disable My or Active. Client Admin retains administrative access and its existing tab presentation.

All permits eligible tenant records. My permits only `assignedUserId` matching the authenticated user. Active uses Inquiry/Hot/Warm on live, non-deleted records; without All it permits only the user's assignments, even when My is disabled. Searches, counts, exports, direct records, relationships and contextual files follow the same server-enforced boundary. Existing assignment restrictions still limit mutations.

Unavailable tabs fall back in All → My → Active order. With no permitted tab, CRM record pages show access denied. Existing authorization events refresh grants and discard protected cached data without a page reload.

Apply `20261221000000_crm_tab_permissions` through the existing guarded deployment path before releasing the matching backend/frontend. It adds `canViewAll`, `canViewMy`, and `canViewActive` to existing permission rows and enables applicable tabs for existing View grants. New rows default to false. Legacy role updates that omit these flags preserve stored selections while View remains enabled; explicit false values revoke them. No CRM ownership or history is rewritten.
