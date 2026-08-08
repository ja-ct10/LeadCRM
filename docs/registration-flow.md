# Registration & Onboarding Flow

> **Last updated:** 2026-08-09
> OTP verification is now implemented and required at registration.

LeadCRM supports two distinct registration pipelines: a comprehensive flow for standard B2B clients (Client Admin), and a fast-track flow for guests exploring the platform.

---

## 1. Client Admin Flow

Used by organizations registering their company on LeadCRM.

### Steps

1. **Basic Details** — Company name, industry, size, and primary business email.
2. **Business Requirements** — Description of CRM needs; optional business document uploads.
3. **Legitimacy Verification** — File uploads: Business Permits, Tax IDs, Owner's Valid ID.
4. **Admin User Details** — First Name, Last Name, Email, Password for the Client Admin account.
5. **Confirmation & Security** — Bot-check + **OTP email verification** + Terms of Service agreement.

### Backend Process

`POST /api/v1/auth/register/client-admin`

- Creates a `Tenant` record with status `PENDING`
- Creates a `User` (Client Admin role) linked to the tenant
- Issues an OTP email verification token via Resend
- Tenant requires System Admin approval before production access
- During `PENDING` phase, the tenant is provisioned a Sandbox environment

### Post-Registration Login

After email verification, the Client Admin uses the two-step OTP login flow (see `docs/authentication.md`). The initial credential verification occurs at `POST /auth/send-otp`, followed by OTP confirmation at `POST /auth/verify-otp`.

---

## 2. Guest Demo Flow (Sandbox Only)

For prospective users who want to test the platform without a full registration.

### Steps

1. **Basic Details** — First Name, Last Name, Email, Password. No company verification.
2. **OTP Verification** — Email OTP sent on submission; must be verified before access.

### Backend Process

`POST /api/v1/auth/register/guest`

- Automatically provisions an isolated, temporary Sandbox `Tenant`
- Creates a `User` with role `GUEST` linked to the sandbox tenant
- On OTP verification, user is immediately granted access with seeded demo data

---

## API Endpoints

```
POST /api/v1/auth/register/client-admin   — full registration with tenant creation
POST /api/v1/auth/register/guest          — sandbox-only fast-track registration
POST /api/v1/auth/send-otp                — step 1 of login (after registration)
POST /api/v1/auth/verify-otp              — step 2 of login (completes session)
```

---

## Email Delivery

Emails are sent via Resend. On the free plan without a verified custom domain, emails can only be delivered to the account owner's email address. The `from` address is locked to `onboarding@resend.dev`.

To send to any recipient, verify a domain in the Resend dashboard and update `RESEND_FROM` in `.env`.

**Dev fallback:** If SMTP/Resend is unconfigured, the OTP/reset URL is logged to the console in development mode. The flow completes without crashing — the token is still written to the database.
