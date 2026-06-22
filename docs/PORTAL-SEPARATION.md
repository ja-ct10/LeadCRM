# Portal Separation Guide

## Why Two Portals?

LeadCRM serves two completely different types of users with different needs:

### CRM Portal (`src/portals/client/`)
- **Who:** Any company that subscribes to LeadCRM (our clients)
- **Role examples:** Client Admin (company manager), Sales Rep, Viewer, Technician
- **What they do:** Manage their own contacts, deals, campaigns, automations, service orders
- **They never see:** Other companies' data, pricing controls, tenant management

### Admin Portal (`src/portals/admin/`)
- **Who:** LeadCRM's own internal team (System Admin role)
- **What they do:** Approve new tenant registrations, manage subscription pricing, monitor infrastructure health, view billing across all tenants
- **They never see:** The CRM modules (contacts, pipeline, etc.) — they have no tenant context

## How the Routing Works

`src/App.tsx` checks `user.role` and routes accordingly:

```typescript
// System Admin → admin portal
if (user.role === 'System Admin') {
  // renders AdminLayout with admin pages
}

// Everyone else → CRM portal
if (['Client Admin', 'Sales Rep', 'Viewer', 'Technician'].includes(user.role)) {
  // renders CrmLayout with CRM pages
}
```

## Key Rule

**Never import a CRM page inside the admin portal, and vice versa.**

Shared components (TrelloFilter, SideSheet, charts) live in `src/shared/` and can be used by both.

## SaaS Analogy

| LeadCRM | Real-world equivalent |
|---|---|
| Admin Portal | Stripe's internal dashboard for managing all merchants |
| CRM Portal | Stripe's merchant dashboard where businesses manage their account |
