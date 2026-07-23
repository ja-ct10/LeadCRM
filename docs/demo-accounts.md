# Demo Accounts & Seeding

LeadCRM includes a database seeder script to populate the development and staging environments with robust test data, including varied tenant structures and pre-configured users for every system role.

## Seed Script

The seed script is located at `backend/src/database/seeders/demo.seed.ts` and is executed via Prisma.

Run the seeder using the following command from the `backend` directory:
```bash
npm run db:seed
```
*Note: This command clears the database and repopulates it with fresh demo data.*

## Available Demo Accounts

All demo accounts share the following password: `admin123` (hashed using argon2 in the database).

| Role | Email | Description |
| :--- | :--- | :--- |
| **System Admin** | `super@leadcrm.com` | Global platform administrator. Has cross-tenant visibility. |
| **Client Admin** | `admin@democorp.com` | Primary admin for the "DemoCorp" tenant. |
| **Sales Rep** | `bob@democorp.com` | Standard sales user within the "DemoCorp" tenant. |
| **Guest** | `guest@democorp.com` | Restricted guest user within the "DemoCorp" tenant. |

## Utilizing Demo Accounts

These accounts are designed to demonstrate the platform's multi-tenant architecture and RBAC implementation. By logging in as different users, you can verify:

1. **Routing:** System Admins are routed to a global management dashboard, while Client Admins and Sales Reps are routed to their tenant-specific CRM views.
2. **Data Isolation:** Ensure that queries made by `admin@democorp.com` do not return data from other seeded tenants (e.g., TechSolutions).
3. **Feature Toggles:** Certain UI elements or API capabilities will be restricted based on the role associated with the session.
