# LeadCRM — Folder Structure

> **Source of truth.** Update this file whenever a folder or file is added, moved, or removed.

---

## Architecture Overview

LeadCRM is a **dual-portal SaaS CRM**:

| Portal | Who Uses It | Entry Path |
|---|---|---|
| **CRM Portal** | Client Admin, Sales Rep, Viewer, Technician | `src/portals/client/` |
| **Admin Portal** | System Admin (LeadCRM developer/operator) | `src/portals/admin/` |

Both portals share common UI, utilities, and state from `src/shared/` and `src/store/`.

---

## Root Structure

```
main-crm-1/                              ← Repo root
│
├── app/                                 ← Next.js 15 App Router (thin shell)
│   ├── layout.tsx                       ← Root HTML, metadata, global CSS
│   └── page.tsx                         ← Loads SPA: dynamic(() => import('../src/App'), {ssr:false})
│
├── src/                                 ← All application source
│   ├── portals/                         ← ★ CORE SEPARATION
│   │   ├── crm/                         ← CLIENT ADMIN PORTAL
│   │   └── admin/                       ← SYSTEM ADMIN PORTAL
│   │
│   ├── shared/                          ← Code used by BOTH portals
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── store/                           ← Global state (React Context)
│   ├── lib/                             ← Pure utilities, no React
│   ├── App.tsx                          ← SPA router (role → portal)
│   └── index.css                        ← Tailwind v4 global styles
│
├── public/                              ← Static assets at /
├── docs/                                ← Project documentation
├── .kiro/                               ← Kiro AI steering + skills
├── .github/workflows/ci.yml
├── package.json
├── next.config.ts
├── shadcn.json
├── .env.example
└── README.md
```

---

## CRM Portal — `src/portals/client/`

**Who uses it:** Client Admin · Sales Rep · Viewer · Technician
**Purpose:** The day-to-day SaaS CRM product that client companies log into.

```
src/portals/client/
│
├── pages/                               ← Route-level containers
│   ├── Dashboard.tsx
│   ├── LandingPage.tsx
│   ├── AuthPage.tsx
│   ├── contacts/
│   │   ├── ContactsPage.tsx
│   │   ├── ContactFormSheet.tsx
│   │   ├── ClientFilters.tsx
│   │   ├── ClientTable.tsx
│   │   └── OrganizationCombobox.tsx
│   ├── pipeline/       → PipelinePage.tsx
│   ├── tasks/          → TaskBoard.tsx
│   ├── workflows/      → WorkflowsPage.tsx
│   ├── campaigns/      → CampaignsPage.tsx
│   ├── reports/        → ReportsPage.tsx
│   ├── service/        → ServiceOrdersPage, AssetsPage, InventoryPage
│   ├── billing/        → BillingPage, ClientBillingPage
│   ├── settings/       → SettingsPage, ProfileSettingsPage, AccountDetailsPage
│   ├── users/          → UsersPage.tsx
│   ├── audit/          → AuditLogsPage.tsx
│   └── technician/     → TechnicianDashboard.tsx
│
├── components/                          ← CRM-only UI components
│   ├── layout/
│   │   └── CrmLayout.tsx                ← Sidebar + topbar for CRM users
│   ├── contacts/
│   │   ├── ClientDetailSheet.tsx
│   │   ├── ClientProfileTabs.tsx
│   │   ├── ClientProfileFiles.tsx
│   │   ├── CompanyProfileTabs.tsx
│   │   ├── UnifiedDetailView.tsx
│   │   └── NotesSidePanel.tsx
│   └── workflows/
│       └── VisualWorkflowBuilder.tsx
│
└── hooks/                               ← CRM-specific custom hooks
    ├── useContacts.ts                   ← filter/sort/search for contacts list
    ├── usePipeline.ts                   ← deal filter, stage, active pipeline
    ├── useWorkflows.ts                  ← workflow filter + filteredWorkflows
    └── useDashboard.ts                  ← metric calculations for dashboard
```

---

## Admin Portal — `src/portals/admin/`

**Who uses it:** System Admin (LeadCRM developer / operator — NOT a tenant)
**Purpose:** Control plane — manage all tenants, pricing, billing, environments.

```
src/portals/admin/
│
├── pages/
│   ├── overview/
│   │   └── AdminDashboard.tsx           ← MRR, churn, tenant growth charts
│   ├── tenants/
│   │   └── ClientManagement.tsx         ← Approve/suspend/reject tenants
│   ├── pricing/
│   │   └── PricingPage.tsx              ← Plan tiers & feature toggles
│   ├── billing/
│   │   └── AdminBillingPage.tsx         ← Cross-tenant invoice management
│   └── environments/
│       └── EnvironmentsPage.tsx         ← Sandbox/Production health monitoring
│
├── components/
│   └── layout/
│       └── AdminLayout.tsx              ← Own sidebar/nav for System Admin
│
└── hooks/
    └── useTenants.ts                    ← Tenant filter/search/counts

NOTE: AdminConsole.tsx remains as a thin tab-router shell for backward
      compatibility. New pages live in the sub-folders above.
```

---

## Shared — `src/shared/`

Used by **both portals**. No portal-specific logic here.

```
src/shared/
│
├── components/
│   ├── ui/                              ← ShadCN UI primitives
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   └── separator.tsx
│   ├── charts/
│   │   └── ChartComponents.tsx          ← Chart.js wrappers (drop-in for Recharts API)
│   ├── EmptyState.tsx
│   ├── GlobalLoader.tsx
│   ├── DashboardSkeleton.tsx
│   ├── CommandPalette.tsx
│   ├── TrelloFilter.tsx
│   ├── SideSheet.tsx
│   ├── SlidingDrawer.tsx
│   └── CountryCodeSelector.tsx
│
└── hooks/
    └── useTheme.ts                      ← Dark/light mode + accent color
```

---

## Store — `src/store/`

```
src/store/
├── AuthContext.tsx                      ← Login, logout, role switching
├── DataContext.tsx                      ← All CRUD, workflow engine, module toggles
├── mockData.ts                          ← Seed data (replaces DB later)
├── types.ts                             ← Legacy flat types (kept for zero-breakage)
└── types/                               ← ★ New split-by-domain types
    ├── index.ts                         ← Re-exports all — import from here
    ├── user.types.ts                    ← User, Tenant, RoleDefinition, Permission
    ├── contact.types.ts                 ← Contact, Organization
    ├── deal.types.ts                    ← Deal, Pipeline, Stage
    ├── workflow.types.ts                ← Workflow, WorkflowAction, PendingAction, WorkflowExecution
    ├── campaign.types.ts                ← Campaign, Template
    └── shared.types.ts                  ← Task, AuditLog, Asset, InventoryItem, ServiceOrder
```

**Migration rule:** New files should import from `src/store/types` (the folder index).
Existing files that import from `src/store/types.ts` still work — do not mass-rename.

---

## Lib — `src/lib/`

Pure functions — no React, no state, no side effects.

```
src/lib/
├── utils.ts        ← cn() class merger, getCRMStatusStyles()
├── countries.ts    ← Country calling codes for phone fields
└── constants.ts    ← PLAN_LIMITS, STATUS_OPTIONS, ROUTE_PATHS, PRODUCTS list
```

---

## DEAD FOLDERS — Removed

| Folder | Why Removed |
|---|---|
| `src/components/ui/`     | Empty — ShadCN lives in `src/shared/components/ui/` |
| `src/components/charts/` | Empty — Charts live in `src/shared/components/charts/` |
| `src/pages/contacts/`    | Empty — CRM pages live in `src/portals/client/pages/` |
| `src/assets/`            | Unused logo — correct logo is `public/leadcrm_logo.png` |

---

## Portal Routing Logic (App.tsx)

```
User authenticates
        │
        ├── role === 'Technician'   ───→  crm/technician/TechnicianDashboard
        ├── role === 'System Admin' ───→  admin/ portal
        │       Routes: admin-dashboard, admin-clients,
        │               admin-pricing, admin-billing, admin-environments
        └── role === 'Client Admin' | 'Sales Rep' | 'Viewer'
                                    ───→  crm/ portal
                        Routes: dashboard, contacts, pipeline, tasks,
                                workflows, campaigns, reports, users,
                                service-orders, assets, inventory,
                                billing, settings, audit-log
```

---

## File Placement Rules

| Scenario | Where it goes |
|---|---|
| New CRM page (used by tenants) | `src/portals/client/pages/<module>/` |
| New Admin page (System Admin only) | `src/portals/admin/pages/<section>/` |
| Component used by only one portal | That portal's `components/` folder |
| Component used by both portals | `src/shared/components/` |
| Hook for one portal's logic | That portal's `hooks/` folder |
| Hook shared between portals | `src/shared/hooks/` |
| TypeScript types (new files) | `src/store/types/<domain>.types.ts` + export from `index.ts` |
| Pure utility function | `src/lib/utils.ts` or new file in `src/lib/` |

---

*Last updated: Phase 1–5 — SOLID structure refactor complete*
*Dead folders removed · hooks/ created · types/ split · AdminLayout added · Admin pages split*
