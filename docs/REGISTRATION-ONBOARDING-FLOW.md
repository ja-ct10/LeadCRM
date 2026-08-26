# Registration & Onboarding Flow

## Overview

LeadCRM implements a production-ready, unified registration → email verification → onboarding pipeline for all users (Client Admin, Guest, and Invited Team Members).

## Flow Diagram

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────────┐     ┌───────────┐
│   /register  │────▶│  POST /register/  │────▶│  /verify-email  │────▶│/onboarding│
│  (2-step form)│     │     guest         │     │  (OTP + Link)   │     │ (3 steps) │
└──────────────┘     └───────────────────┘     └─────────────────┘     └───────────┘
                              │                         │                      │
                     Creates: Tenant(SANDBOX)    Activates user      Saves workspace
                     + User(PENDING)             Issues JWT           Sends invites
                     + Pipeline                  Auto-login           Marks complete
                     Sends verification email                         Sends welcome email
                                                                      Tenant → ACTIVE
```

## Registration

**Endpoint:** `POST /api/v1/auth/register/guest`

Both Client Admin and Guest use this unified endpoint. The first user in a tenant receives the "Client Admin" role automatically.

### Request Body
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecureP@ss1",
  "companyName": "Acme Inc",
  "industry": "IT Solutions",
  "companySize": "11-50",
  "acceptTerms": true,
  "invitationToken": "optional-token-for-invited-users"
}
```

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (`!@#$%^&*()_+-=[]{}` etc.)

### What Happens on Registration
1. Email normalized (lowercase, trimmed)
2. Duplicate check (global email uniqueness)
3. Password hashed (bcrypt)
4. **If invitation token present:** user joins existing tenant with specified role
5. **If no invitation:** creates new Tenant (SANDBOX) + User (PENDING) + Account + Pipeline
6. Generates magic link token (SHA-256 hash stored in `EmailVerificationToken`)
7. Generates 6-digit OTP (bcrypt hash stored in `RegistrationOtpToken`)
8. Sends combined verification email (magic link button + OTP code)
9. Returns `{ user: { id, email, role, tenantId, emailSent } }`

## Email Verification

Two methods available (Stripe-style: both in same email):

### Method A: Magic Link (Primary)
**Endpoint:** `GET /api/v1/auth/verify-email?token=xxx`

- User clicks link in email
- Backend validates SHA-256 hash, checks expiry (24 hours), checks single-use
- On success: activates user, issues JWT, sets `leadcrm_token` cookie, redirects to `/onboarding`
- On error: redirects to `/verify-email?error=expired&email=xxx` or `?error=invalid`

### Method B: OTP Code (Fallback)
**Endpoint:** `POST /api/v1/auth/verify-registration-otp`

```json
{ "email": "john@example.com", "code": "123456" }
```

- 6-digit code, 10-minute TTL, 5-attempt maximum
- On success: activates user, issues JWT, sets `leadcrm_token` cookie
- Returns user data + `redirectTo: '/onboarding'`

### Resend Verification
**Endpoint:** `POST /api/v1/auth/resend-verification`

```json
{ "email": "john@example.com" }
```

- Invalidates all old tokens, generates fresh link + OTP, sends new email
- Rate limited: 1 per minute per IP
- Always returns success (no email existence leakage)

## Login Enforcement

`POST /api/v1/auth/login` now enforces:
1. Password validation
2. **Email verification check** — users with `emailVerified: null` get 403
3. Account status check — INACTIVE users get 403

Existing users are unaffected (migration sets `emailVerified = createdAt` for all existing ACTIVE users).

## Onboarding (3 Steps)

After verification, users land on the onboarding wizard:

### Step 1: Workspace Setup
**Endpoint:** `PATCH /api/v1/auth/onboarding/workspace`

```json
{
  "companyName": "Acme Inc",
  "industry": "IT Solutions",
  "companySize": "11-50",
  "timezone": "Asia/Manila"
}
```

### Step 2: Invite Team (Optional — can skip)
**Endpoint:** `POST /api/v1/invitations`

```json
{
  "emails": ["teammate@acme.com", "sales@acme.com"],
  "roleId": "uuid-of-role"
}
```

Invited users receive an email with a link to `/register?invitation=<token>&email=<email>`.

### Step 3: Quick Tour → Complete
**Endpoint:** `POST /api/v1/auth/onboarding/complete`

- Sets `Tenant.onboardingCompletedAt = now`
- Sets `Tenant.status = ACTIVE`
- Sends welcome email
- Frontend redirects to `/dashboard`

### Progress Tracking
**Endpoint:** `GET /api/v1/auth/onboarding/status`

Returns `{ step, completedAt, tenant: { name, industry, companySize } }`. Used to resume from saved step if user leaves mid-onboarding.

## Team Invitations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/invitations` | POST | Yes (users.manage) | Create + send invitations |
| `/api/v1/invitations` | GET | Yes | List pending invitations |
| `/api/v1/invitations/:id` | DELETE | Yes (users.manage) | Revoke invitation |

Invitation tokens expire in 7 days. Accepted invitations are marked (not deleted) for audit.

## Route Guards (Frontend)

### AuthGuard Priority
1. **Unauthenticated** → redirect to `/login`
2. **Email not verified** (`user.emailVerified === null`) → redirect to `/verify-email?email=xxx`
3. **Onboarding not complete** (`user.onboardingCompletedAt === null`) → redirect to `/onboarding`
4. **System Admin** → bypasses all onboarding gates

### Exempt Routes (accessible during verification/onboarding)
- `/verify-email`, `/email-verification`
- `/onboarding`
- `/billing`, `/settings`
- `/company-setup`

## Security

| Measure | Implementation |
|---------|---------------|
| Token hashing | Magic link: SHA-256. OTP: bcrypt |
| Token entropy | `crypto.randomBytes(32)` — 256 bits |
| Token expiry | Link: 24h. OTP: 10 min. Invitation: 7 days |
| Single-use tokens | `usedAt` timestamp prevents replay |
| Rate limiting | Register: 10/hr. Verify link: 10/hr. Resend: 1/min. Login: 10/15min |
| Password strength | Regex: upper + lower + digit + special, min 8 chars |
| Email normalization | All lookups use `toLowerCase().trim()` |
| No info leakage | Resend/forgot-password always return success |
| Session management | JWT in HttpOnly cookie, SameSite=Lax, Secure in production |
| Grandfather clause | Existing ACTIVE users have `emailVerified` backfilled in migration |

## Environment Variables

```bash
# Required for email verification links
APP_URL="https://your-frontend.vercel.app"

# Token TTL (optional — has defaults)
EMAIL_VERIFICATION_TOKEN_TTL_HOURS="24"   # default: 24
INVITATION_TOKEN_TTL_DAYS="7"             # default: 7
PASSWORD_RESET_TTL_MINUTES="60"           # default: 60

# Email transport (at least one required for production)
GMAIL_SYSTEM_SENDER_USER_ID="system"      # Gmail OAuth2 system sender
RESEND_API_KEY="re_xxxxxx"                # Resend fallback
RESEND_FROM="LeadCRM <noreply@yourdomain.com>"
```

## Deployment Checklist

- [ ] Run Prisma migration: `npx prisma migrate deploy`
- [ ] Verify `APP_URL` env var points to production frontend
- [ ] Verify `RESEND_API_KEY` is set (or Gmail system sender configured)
- [ ] Verify `NODE_ENV=production` for production rate limits
- [ ] Test email delivery end-to-end (register → verify → onboarding)
- [ ] Confirm `/verify-email` route is accessible without authentication
- [ ] Verify existing ACTIVE users can still login (grandfather clause migration)
- [ ] Verify System Admin users bypass onboarding gates
- [ ] Check rate limits: 10 login attempts/15min, 1 resend/min in production

## Database Models Added

```prisma
model EmailVerificationToken {
  id        String    @id @default(uuid())
  userId    String?
  email     String
  tokenHash String    @unique  // SHA-256 hex
  type      String    @default("EMAIL_VERIFICATION")
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User?     @relation(...)
}

// Added to Tenant model:
onboardingStep        Int       @default(0)
onboardingCompletedAt DateTime?
```
