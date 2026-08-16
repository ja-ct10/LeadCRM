# LeadCRM Authentication Architecture

> **Last updated:** 2026-08-09
> This document reflects the current implementation — OTP-based login, JWT in HttpOnly cookies, custom `AuthContext`. NextAuth is **not** used.

## Overview

Authentication uses a two-step OTP flow. Credentials are verified first, then a one-time code is emailed for the user to confirm. On success, the backend issues a JWT stored in an HttpOnly cookie. All session state lives in `AuthContext` — not in NextAuth.

## Auth Stack

| Concern | Implementation |
|---|---|
| Session token | JWT in HttpOnly cookie (`leadcrm_token`) |
| Password hashing | `bcryptjs` (12 salt rounds) |
| OTP storage | `LoginOtpToken` model — bcrypt hash of code, `attempts` counter, upsert on resend |
| Email delivery | Resend (`onboarding@resend.dev` until custom domain verified) |
| Frontend state | `AuthContext` (`store/AuthContext.tsx`) |
| Route protection | `AuthGuard` component (client-side) — no Next.js middleware |

## Login Flow (Two-Step OTP)

```
1. POST /auth/send-otp   { email, password }
   → Validates credentials against DB
   → Creates/updates LoginOtpToken (bcrypt hash, 5-minute expiry, upsert)
   → Emails OTP code via Resend
   → Returns { success: true } — no JWT yet
   → AuthContext.login() returns true to mean "OTP sent"

2. POST /auth/verify-otp  { email, otp }
   → Validates code against LoginOtpToken.hash
   → Increments attempts on failure (max 5)
   → On success: issues JWT, sets HttpOnly cookie, returns full user object
   → AuthContext.verifyOtp() sets user + tenant state
```

## Session Restore

```
GET /auth/me
  → Reads leadcrm_token cookie
  → Queries User table by userId + tenantId from JWT (not raw JWT payload)
  → Returns full user: id, email, role, firstName, lastName, tenantId
  → AuthContext.restoreSession() called on app mount
```

The `/auth/me` endpoint queries the database — it never returns the raw JWT payload. This confirms the user still exists and returns `firstName`/`lastName` which the JWT does not carry.

## Frontend API Client

All requests must include `credentials: 'include'` so the browser sends the HttpOnly cookie:

```typescript
// CORRECT — cookie sent automatically
const res = await fetch(`${API_URL}${path}`, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
});

// WRONG — no session is established without the cookie
const res = await fetch(`${API_URL}${path}`);
```

## Password Reset Flow

```
POST /auth/forgot-password  { email }
  → Creates PasswordResetToken (bcrypt hash, 1-hour expiry)
  → Emails link: /reset-password?token=...
  → app/reset-password/page.tsx must exist (Next.js returns 404 otherwise)

POST /auth/reset-password   { token, newPassword }
  → Validates token hash
  → Updates User.passwordHash with new bcryptjs hash
  → Invalidates token
```

**Dev note:** If `RESEND_FROM` / SMTP is unconfigured, the reset URL is logged to console in development and the flow continues — it does not crash.

## Security Rules

- JWT payload contains only: `userId`, `tenantId`, `role` — no PII
- Logout invalidates the server-side session (cookie cleared)
- Login rate-limited: 5 attempts / 15 min
- Password reset rate-limited: 3 requests / hour
- OTP brute-force: 5 attempts before token invalidated
- Passwords never stored in plain text — bcryptjs 12 rounds
- `tenantId` is included in the login response (`res.data.user.tenantId`) — required for `AuthContext` to set the `tenant` state

## Required Backend Response Shape (Login)

```typescript
// /auth/verify-otp response — must include tenantId
{
  success: true,
  data: {
    user: {
      id: string,
      email: string,
      role: string,
      firstName: string,
      lastName: string,
      tenantId: string   // required — AuthContext reads this to set tenant
    }
  }
}
```

## Dependencies

- **Backend:** `jsonwebtoken`, `bcryptjs`, `@prisma/client`, `resend`
- **Frontend:** `AuthContext` (`store/AuthContext.tsx`), `AuthGuard` (`shared/providers/auth-guard.tsx`)
- **Not used:** `next-auth`, `argon2`, `next-auth/react`, `getSession()`
