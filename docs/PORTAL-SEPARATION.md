# LeadCRM — Portal Separation Guide

## Why Two Portals?

LeadCRM serves two completely different user types with different data access, layouts, and capabilities.

### CRM Portal (`frontend/src/features/tenant/`)
- **Who:** Any company that subscribes to LeadCRM (our clients / tenants)
- **Roles:** Client Admin, Sales Rep, Viewer, Technician
- **What they do:** Manage their own contacts, deals, campaigns, workflows, service orders
- **They never see:** Other companies' data, system pricing controls, tenant management

### Admin Portal (`frontend/src/features/system-admin/`)
- **Who:** LeadCRM's own internal team (System Admin role only)
- **What they do:** Approve tenant registrations, manage subscription pricing, monitor infrastructure health, view billing across all tenants
- **They never see:** CRM module data (contacts, pipeline, etc.) — they have no tenant context

---

## Physical Separation (Not Just Route Groups)

The portals are separated at the **file system level**, not just in routing.

```
frontend/src/features/
├── tenant/       ← CRM portal — all CRM page components and logic live here
└── system-admin/ ← Admin portal — completely separate, no shared pages
```

This means it is **structurally impossible** to accidentally import a CRM page into the admin portal. The import would require crossing the `features/tenant/` ↔ `features/system-admin/` boundary, which is immediately obvious in code review.

Shared components (TrelloFilter, SideSheet, charts, ShadCN primitives) live in `src/shared/` and are available to both portals.

---

## How Routing Works

The App Router uses two route groups:
- `app/(tenant)/` — CRM portal routes (no URL segment added)
- `app/(system-admin)/` — Admin portal routes (URLs: `/admin/*`)

Each group has its own `layout.tsx` which applies the correct portal layout via `CrmLayout` or `AdminLayout`.

Role-based redirect:
- `System Admin` → `/admin/dashboard`
- All other roles → `/dashboard`

---

## SaaS Analogy

| LeadCRM | Real-world equivalent |
|---|---|
| `features/system-admin/` | Stripe's internal dashboard — manage all merchants |
| `features/tenant/` | Stripe's merchant dashboard — manage your own account |

The two portals share zero page-level components. They may share UI primitives from `src/shared/`.

---

## Rules

1. **Never import a CRM page inside `features/system-admin/`**
2. **Never import an admin page inside `features/tenant/`**
3. Shared UI components only — import from `src/shared/`
4. RBAC is always checked — `System Admin` is the only cross-tenant role
5. `tenantId` must be on every piece of data — System Admin is the only one who can query across tenants
