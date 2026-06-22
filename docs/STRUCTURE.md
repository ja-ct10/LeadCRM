# LeadCRM — Project Structure

## Portal Separation

LeadCRM has two completely distinct user-facing portals:

| Portal | Who Uses It | Entry Path | Purpose |
|---|---|---|---|
| **Client Portal** | Client Admin, Sales Rep, Viewer, Technician | `src/portals/client/` | Day-to-day CRM operations for companies that subscribe to LeadCRM |
| **Admin Portal** | System Admin (LeadCRM operator/developer) | `src/portals/admin/` | Platform control — manage tenants, pricing, environments, billing |

These portals share no UI components. They have separate layouts, separate navigation, and separate module ownership.

---

## Architecture Overview

```
src/
├── App.tsx                    # SPA root — thin, delegates to portals
├── index.css                  # Global styles
│
├── core/                      # Cross-cutting infrastructure (auth, permissions, audit, tenant)
├── modules/                   # Feature domains — owned by the CLIENT portal
├── portals/                   # Portal shells (layout, routing, navigation config)
│   ├── client/                # CLIENT portal shell
│   └── admin/                 # ADMIN portal shell + admin-specific modules
├── shared/                    # Reusable code used by BOTH portals
├── store/                     # Global state (being migrated → core/ + module services)
└── lib/                       # Utilities, constants, helpers
```

---

## Design Principles

- **Domain ownership** — each module owns its own types, hooks, services, and components
- **No god files** — max 400 lines for components, 800 for pages
- **Service layer** — business logic lives in `services/`, not in pages or DataContext
- **Thin pages** — pages are orchestrators that compose hooks + components
- **Migration-ready** — service functions can swap localStorage for API calls with no UI changes
- **SOLID enforced** — single responsibility, open for extension, no cross-module mutation

---

## Target Folder Structure

### `src/core/` — Infrastructure Layer

Cross-cutting concerns shared by the entire application.

```
core/
├── auth/
│   ├── AuthContext.tsx          # Auth state + login/logout
│   └── useAuth.ts               # Hook wrapper
├── permissions/
│   ├── PermissionContext.tsx
│   └── usePermissions.ts        # Role + permission resolution
├── audit/
│   └── useAuditLog.ts           # Audit logging hook
├── tenant/
│   └── useTenant.ts             # Current tenant context
└── data/
    └── DataContext.tsx          # Thin orchestrator — delegates to module services
```

---

### `src/modules/` — Feature Domains (Client Portal)

Each domain follows the same internal structure:

```
modules/<domain>/
├── types/         # Domain-specific TypeScript types and interfaces
├── schemas/       # Validation schemas (Zod — planned)
├── services/      # Business logic — extracted from DataContext
├── hooks/         # Custom React hooks for this domain
├── components/    # Domain-specific UI components
└── pages/         # Route-level page components (thin orchestrators)
```

#### Contacts Domain
```
modules/contacts/
├── types/
│   ├── contact.types.ts
│   └── organization.types.ts
├── schemas/
│   └── contactSchema.ts
├── services/
│   └── contactService.ts        # CRUD + business rules
├── hooks/
│   ├── useContacts.ts
│   ├── useContactFilters.ts
│   ├── useContactForm.ts
│   └── useContactPermissions.ts
├── components/
│   ├── ContactTable.tsx
│   ├── ContactFormSheet.tsx
│   ├── ContactFilters.tsx
│   ├── profile/
│   │   ├── ContactProfileTabs.tsx
│   │   ├── CompanyProfileTabs.tsx
│   │   └── tabs/
│   │       ├── ContactActivitiesTab.tsx
│   │       ├── ContactEmailTab.tsx
│   │       └── ContactSmsTab.tsx
│   └── detail/
│       ├── ContactDetailSheet.tsx
│       └── UnifiedDetailView.tsx
└── pages/
    └── ContactsPage.tsx
```

#### Pipeline Domain
```
modules/pipeline/
├── types/
├── services/
│   └── dealService.ts
├── hooks/
│   ├── usePipeline.ts
│   ├── useDealFilters.ts
│   ├── useDealForm.ts
│   └── useDealDragDrop.ts       # @dnd-kit logic extracted
├── components/
│   ├── KanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   ├── DealCard.tsx
│   ├── DealFormModal.tsx
│   ├── DealDetailPanel.tsx
│   ├── PipelineAnalytics.tsx
│   ├── PipelineFilters.tsx
│   └── PipelineTableView.tsx
└── pages/
    └── PipelinePage.tsx          # Thin orchestrator
```

#### Other Domains (same structure)
- `modules/workflows/` — automation rules, visual builder, execution logs
- `modules/campaigns/` — email/SMS campaigns, templates, analytics
- `modules/tasks/` — task board, task management
- `modules/service-orders/` — service orders, assets, inventory
- `modules/billing/` — billing pages, invoice management
- `modules/reports/` — analytics dashboards
- `modules/users/` — team management, roles, permissions
- `modules/settings/` — appearance, modules, security, notifications
- `modules/audit/` — audit log viewer

---

### `src/portals/client/` — Client Portal Shell

The SaaS product UI used by companies that subscribe to LeadCRM.

```
portals/client/
├── layout/
│   └── CrmLayout.tsx            # Sidebar + header + navigation
├── navigation/
│   └── navConfig.ts             # Nav items with RBAC config
├── router/
│   └── ClientRouter.tsx         # Route → module mapping
└── pages/
    ├── Dashboard.tsx             # Client dashboard
    ├── LandingPage.tsx           # Marketing landing page
    └── AuthPage.tsx              # Login / register
```

**Who uses this portal:**
- `Client Admin` — manages their company's CRM instance
- `Sales Rep` — manages contacts and pipeline deals
- `Viewer` — read-only access
- `Technician` — service orders only

---

### `src/portals/admin/` — Admin Portal Shell

The LeadCRM operator console. Used ONLY by the LeadCRM development team.

```
portals/admin/
├── layout/
│   └── AdminLayout.tsx          # Admin sidebar + header
├── modules/
│   ├── tenants/                  # Tenant/client management
│   │   ├── hooks/
│   │   │   └── useTenants.ts
│   │   ├── components/
│   │   └── pages/
│   │       └── ClientManagement.tsx
│   ├── billing/                  # Platform billing
│   │   └── pages/
│   │       └── AdminBillingPage.tsx
│   ├── pricing/                  # Plan pricing management
│   │   └── pages/
│   │       └── PricingPage.tsx
│   ├── environments/             # Infrastructure health
│   │   └── pages/
│   │       └── EnvironmentsPage.tsx
│   └── overview/                 # Platform analytics
│       └── pages/
│           └── AdminDashboard.tsx
└── pages/
    └── AdminConsole.tsx          # Tabbed admin shell
```

**Who uses this portal:**
- `System Admin` only — the LeadCRM operator/developer
- Has cross-tenant visibility
- Manages pricing, tenant onboarding, environment health, platform billing

---

### `src/shared/` — Shared Components

Reusable UI and logic used by BOTH portals.

```
shared/
├── components/
│   ├── ui/                      # ShadCN primitives (Button, Badge, Card, etc.)
│   ├── charts/
│   │   └── ChartComponents.tsx  # Chart.js wrapper — ONLY import source for charts
│   ├── TrelloFilter.tsx         # Filter UI — ONLY filter component to use
│   ├── EmptyState.tsx
│   ├── SideSheet.tsx
│   ├── SlidingDrawer.tsx
│   ├── CommandPalette.tsx
│   ├── GlobalLoader.tsx
│   ├── DashboardSkeleton.tsx
│   └── CountryCodeSelector.tsx
└── hooks/
    └── useTheme.ts
```

---

### `src/store/` — Global State (transitional)

During the current localStorage phase, state lives here. As the architecture matures, domain state migrates into `src/modules/<domain>/services/`.

```
store/
├── AuthContext.tsx               # Auth — migrating to core/auth/
├── DataContext.tsx               # Thin orchestrator — delegates to module services
├── types.ts                     # Legacy type file — kept for zero-breakage migration
├── types/                       # Split type files (canonical — use these for new code)
│   ├── index.ts                 # Re-exports all types
│   ├── contact.types.ts
│   ├── deal.types.ts
│   ├── user.types.ts
│   ├── workflow.types.ts
│   ├── campaign.types.ts
│   └── shared.types.ts
└── mockData/                    # Seed data split by domain
    ├── contacts.mock.ts
    ├── deals.mock.ts
    ├── workflows.mock.ts
    ├── campaigns.mock.ts
    ├── users.mock.ts
    └── index.ts                 # Re-exports all mock data
```

---

### `src/lib/` — Utilities

```
lib/
├── utils.ts          # cn() and shared utility functions
├── constants.ts      # App-wide constants
└── countries.ts      # Country/region data
```

---

## Migration Status

The project is being incrementally migrated from the current structure to the target structure above.

| Phase | Status | Description |
|---|---|---|
| A — Folder Scaffolding | ✅ Complete | Target directories created |
| B — mockData Split | 🔲 Pending | Split 1,295-line mockData.ts by domain |
| C1 — Tasks Domain | 🔲 Pending | Extract TaskBoard (526 lines) |
| C2 — Reports Domain | 🔲 Pending | Extract ReportsPage (208 lines) |
| C3 — Campaigns Domain | 🔲 Pending | Split CampaignsPage (1,378 lines) |
| C4 — Workflows Domain | 🔲 Pending | Split WorkflowsPage (1,102 lines) |
| C5 — Contacts Domain | 🔲 Pending | Split contact components |
| C6 — Settings Domain | 🔲 Pending | Split SettingsPage (1,836 lines) |
| C7 — Users Domain | 🔲 Pending | Split UsersPage (2,822 lines) |
| C8 — Pipeline Domain | 🔲 Pending | Split PipelinePage (3,224 lines) |

---

## Component Size Rules

| File Type | Target | Warning | Hard Limit |
|---|---|---|---|
| Components | 250 lines | 300 lines | 400 lines |
| Pages | 500 lines | 600 lines | 800 lines |
| Hooks | 100 lines | 150 lines | 200 lines |
| Services | 100 lines | 150 lines | 200 lines |
| Utils | 100 lines | 150 lines | 150 lines |

Files over the hard limit must be split before new features are added.

---

## Import Path Convention

With the modules structure, prefer clean imports via barrel files:

```typescript
// AVOID — deep relative path
import { useContacts } from '../../../../portals/client/hooks/useContacts';

// PREFER — domain-relative
import { useContacts } from '../../hooks/useContacts';

// FUTURE — barrel import (when barrel files are added)
import { useContacts } from '@/modules/contacts/hooks';
```

---

## Currently Open Violations

These files exist and work but violate the target structure. They are tracked as technical debt:

| File | Lines | Violation | Priority |
|---|---|---|---|
| `portals/client/pages/pipeline/PipelinePage.tsx` | 3,224 | God file — 8+ concerns | HIGH |
| `portals/client/pages/users/UsersPage.tsx` | 2,822 | God file — roles + users + permissions | HIGH |
| `store/DataContext.tsx` | 1,894 | God context — all domains in one file | HIGH |
| `portals/client/pages/settings/SettingsPage.tsx` | 1,836 | God file — 5+ settings domains | MEDIUM |
| `portals/client/pages/campaigns/CampaignsPage.tsx` | 1,378 | Mixed concerns | MEDIUM |
| `portals/admin/pages/AdminConsole.tsx` | 1,356 | All admin views in one file | MEDIUM |
| `portals/client/pages/settings/ProfileSettingsPage.tsx` | 1,299 | Multiple settings sections | MEDIUM |
| `store/mockData.ts` | 1,295 | All domain seed data in one file | LOW |
