# Registration & Onboarding Flow

LeadCRM supports two distinct registration pipelines: a comprehensive flow for standard B2B clients, and a fast-track flow for guests exploring the platform.

## 1. Client Admin Flow (Production Ready)

This is the standard multi-step wizard used by organizations intending to use LeadCRM for their business operations.

### Steps
1. **Basic Details**: Company name, industry, size, and primary business email.
2. **Business Requirements**: A text description of the company's specific CRM needs, with an option to upload initial business documents.
3. **Legitimacy Verification**: File uploads for Business Permits, Tax IDs, and Owner's Valid ID to prevent fraud.
4. **Admin User Details**: Creation of the primary `Client Admin` account (First Name, Last Name, Email, Password).
5. **Confirmation & Security**: A bot-check, OTP email verification, and agreement to Terms of Service.

### Backend Process
- When submitted, the backend (`POST /api/v1/auth/register/client-admin`) creates a `Tenant` record with a status of `PENDING`.
- It also creates a `User` (the Client Admin) linked to this tenant, and issues an email verification token.
- The tenant requires approval from a System Admin before the `Client Admin` can access production features. During the pending phase, they are provisioned a Sandbox environment.

## 2. Guest Demo Flow (Sandbox Only)

This flow is designed for rapid onboarding of users who just want to test the CRM's capabilities.

### Steps
1. **Basic Details**: First Name, Last Name, Email, and Password. No company verification required.

### Backend Process
- The backend (`POST /api/v1/auth/register/guest`) automatically provisions an isolated, temporary Sandbox `Tenant`.
- It creates a `User` with the role `GUEST` linked to this sandbox tenant.
- The user is immediately granted access to log in and explore the platform using mock/seeded data.

## API Endpoints

- `POST /api/v1/auth/register/client-admin`
- `POST /api/v1/auth/register/guest`
