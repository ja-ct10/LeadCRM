# LeadCRM — Seed Accounts

## Demo Credentials

| Role | Email | Password | OTP |
|---|---|---|---|
| System Admin | admin@gmail.com | admin123 | 000000 |
| System Admin (alias) | super@leadcrm.com | admin123 | 000000 |
| Client Admin | admin@democorp.com | admin123 | 000000 |
| Sales Rep | bob@democorp.com | admin123 | 000000 |
| Guest | guest@democorp.com | guest123 | 000000 |

OTP `000000` works when `DEV_OTP_BYPASS=true` (local) or `DEMO_MODE=true` (Render/staging).

## How to Seed Locally

```bash
# From monorepo root
npm run db:seed

# Or from backend/
npx prisma db seed
```

All accounts use `upsert` — safe to run multiple times without creating duplicates.

## How the Login Flow Works

Login is a 2-step OTP process:

```
Step 1: POST /api/v1/auth/send-otp  { email, password }
          → verifies credentials, sends OTP to email
          → demo accounts: stores fixed code "000000" (no email sent)

Step 2: POST /api/v1/auth/verify-otp  { email, code }
          → verifies OTP, issues JWT in HttpOnly cookie
```

All 5 demo accounts live in the **`User`** table (not `SystemAdmin`) so they work through the standard login endpoint.

## Render / Production Setup

### 1. Set these env vars in the Render dashboard

| Variable | Value |
|---|---|
| `DATABASE_URL` | Render Internal DB URL (from your Render PostgreSQL service) |
| `JWT_SECRET` | strong random string, 32+ chars |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://lead-crm-frontend-pi.vercel.app` |
| `APP_URL` | `https://lead-crm-frontend-pi.vercel.app` |
| `SYSTEM_ADMIN_EMAIL` | `admin@gmail.com` |
| `SYSTEM_ADMIN_PASSWORD` | `admin123` |
| `DEMO_MODE` | `true` |
| `DEV_SEED_EMAILS` | `admin@gmail.com,super@leadcrm.com,admin@democorp.com,bob@democorp.com,guest@democorp.com` |
| `SKIP_DEMO_TENANTS` | `true` |

> Use the **Internal Database URL** for `DATABASE_URL` when the backend runs on Render — it uses the private network and is faster. Never use the external URL in the backend service.

### 2. Render deployment (automatic via render.yaml)

The `render.yaml` in the repo root configures Render to automatically:
1. Build: `npm install && npx prisma generate && npx tsc`
2. Start: `npx prisma migrate deploy && SKIP_DEMO_TENANTS=true npx prisma db seed && node dist/server.js`

This ensures migrations are applied and demo accounts are seeded on every deploy.

### 3. Manual seed (if needed)

To seed the Render database without a full redeploy, use the Render **Shell** tab on the backend service:

```bash
SKIP_DEMO_TENANTS=true npx prisma db seed
```

Never point your local `DATABASE_URL` at the production database.

## Vercel Frontend Setup

Set these env vars in Vercel → Project Settings → Environment Variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://leadcrm-backend-os8d.onrender.com/api/v1` |
| `NEXT_PUBLIC_USE_MOCK_AUTH` | `false` |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `false` |

After adding/changing env vars, **redeploy** the Vercel project for them to take effect.

## Account Coverage

| Account | DB (local) | DB (Render) | OTP bypass |
|---|---|---|---|
| admin@gmail.com | ✅ seeded | ✅ seeded on deploy | ✅ DEV_SEED_EMAILS + DEMO_MODE |
| super@leadcrm.com | ✅ seeded | ✅ seeded on deploy | ✅ DEV_SEED_EMAILS + DEMO_MODE |
| admin@democorp.com | ✅ seeded | ✅ seeded on deploy | ✅ DEV_SEED_EMAILS + DEMO_MODE |
| bob@democorp.com | ✅ seeded | ✅ seeded on deploy | ✅ DEV_SEED_EMAILS + DEMO_MODE |
| guest@democorp.com | ✅ seeded | ✅ seeded on deploy | ✅ DEV_SEED_EMAILS + DEMO_MODE |

## Architecture Note

All 5 demo accounts are written to the **`User`** model (tenant-scoped), not the `SystemAdmin` model. The `SystemAdmin` model is for future cross-tenant operator features and is not consulted by the login endpoint.

System Admin accounts (`admin@gmail.com`, `super@leadcrm.com`) are placed in the `leadcrm-system-demo` tenant with `role: 'System Admin'`.
