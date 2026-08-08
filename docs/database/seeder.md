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

## How to Seed

```bash
# From monorepo root or backend/
npm run db:seed
```

## Render / Production Setup

1. Set these env vars on Render:

| Variable | Value |
|---|---|
| `SYSTEM_ADMIN_EMAIL` | `admin@gmail.com` |
| `SYSTEM_ADMIN_PASSWORD` | `admin123` |
| `DEMO_MODE` | `true` |
| `DEV_SEED_EMAILS` | `admin@gmail.com,admin@democorp.com,bob@democorp.com,super@leadcrm.com,guest@democorp.com` |

2. Temporarily point local `backend/.env` `DATABASE_URL` to the Render DB connection string.
3. Run `npm run db:seed` from the `backend/` folder.
4. Restore the local `DATABASE_URL`.
5. Redeploy the Render service.

## Account Coverage — All Layers

| Account | DB (local) | DB (Render — after seed) | Mock auth | OTP bypass |
|---|---|---|---|---|
| admin@gmail.com | ✅ | needs seed | ✅ MOCK_USERS | ✅ DEV_SEED_EMAILS |
| super@leadcrm.com | ✅ | needs seed | ✅ MOCK_USERS | ✅ DEV_SEED_EMAILS |
| admin@democorp.com | ✅ | needs seed | ✅ MOCK_USERS | ✅ DEV_SEED_EMAILS |
| bob@democorp.com | ✅ | needs seed | ✅ MOCK_USERS | ✅ DEV_SEED_EMAILS |
| guest@democorp.com | ✅ | needs seed | ✅ MOCK_USERS | ✅ DEV_SEED_EMAILS |
