# LeadCRM — Portal Separation Guide

## Why Two Portals?

LeadCRM serves two completely different user types with different data access, layouts, and capabilities.

### CRM Portal (`frontend/src/client-admin/`)
- **Who:** Any company that subscribes to LeadCRM (our clients / tenants)
- **Roles:** Client Admin, Sales Rep, Viewer, Technician
- **What they do:** Manage their own contacts, deals, campaigns, workflows, service orders
- **They never see:** Other companies' data, system pricing controls, tenant management

### Admin Portal (`frontend/src/system-admin/`)
- **Who:** LeadCRM's own internal team (System Admin role only)
- **What they do:** Approve tenant registrations, manage subscription pricing, monitor infrastructure health, view billing across all tenants
- **They never see:** CRM module data (contacts, pipeline, etc.) — they have no tenant context

---

## Physical Separation (Not Just Route Groups)

The portals are separated at the **file system level**, not just in routing.

```
frontend/src/
├── client-admin/     ← CRM portal — all CRM page components and logic live here
└── system-admin/     ← Admin portal — completely separate, no shared pages
```

This means it is **structurally impossible** to accidentally import a CRM page into the admin portal. The import would require crossing the `client-admin/` ↔ `system-admin/` boundary, which is immediately obvious in code review.

Shared components (TrelloFilter, SideSheet, charts, ShadCN primitives) live in `src/shared/` and are available to both portals.

---

## How Routing Works (SPA Phase)

`src/App.tsx` checks `user.role` and renders the appropriate layout:

```typescript
// System Admin → admin layout + admin pages
if (user.role === 'System Admin') {
  return <AdminLayout>...<AdminConsole /></AdminLayout>;
}

// All other roles → CRM layout + CRM pages
// Client Admin bypasses all permission checks for their own tenant
return <CrmLayout><ContactsPage />...</CrmLayout>;
```

---

## SaaS Analogy

| LeadCRM | Real-world equivalent |
|---|---|
| `system-admin/` | Stripe's internal dashboard — manage all merchants |
| `client-admin/` | Stripe's merchant dashboard — manage your own account |

The two portals share zero page-level components. They may share UI primitives from `src/shared/`.

---

## Rules

1. **Never import a CRM page inside `system-admin/`**
2. **Never import an admin page inside `client-admin/`**
3. Shared UI components only — import from `src/shared/`
4. RBAC is always checked — `System Admin` is the only cross-tenant role
5. `tenantId` must be on every piece of data — System Admin is the only one who can query across tenants
