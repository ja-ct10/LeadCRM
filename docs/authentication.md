# LeadCRM Authentication Architecture

LeadCRM utilizes a decoupled authentication system designed for modern multi-tenant SaaS applications, emphasizing security, scalability, and seamless user experience.

## Overview

The authentication architecture is split between a **Next.js Frontend (NextAuth.js)** and an **Express.js Backend**, ensuring that session management is handled efficiently by the frontend framework, while business logic and data security remain firmly in the backend.

### Core Components

1. **NextAuth.js (Frontend Session Management)**
   - Responsible for maintaining the user session in the browser.
   - Uses the NextAuth `CredentialsProvider`.
   - Stores a secure JWT containing basic user info (`id`, `email`, `role`, `tenantId`, `firstName`, `lastName`).
   - Handles route protection via Next.js Middleware.

2. **Express API (Backend Single Source of Truth)**
   - Handles the actual authentication logic, password hashing (Argon2), and database lookups.
   - Manages role-based access control (RBAC), tenant isolation, and security logging.
   - Provides a stateless JWT for API authorization.

## Authentication Flow

### 1. Login Process
1. User submits credentials (email/password) on the `/login` page.
2. NextAuth `signIn('credentials')` is triggered.
3. NextAuth sends a request to the Express backend (`POST /api/v1/auth/login`).
4. The Express backend verifies credentials against the database.
5. If successful, the backend returns a payload containing user details and an API JWT.
6. NextAuth serializes this payload into its own secure session JWT.
7. User is redirected to the `/dashboard`.

### 2. Protected API Requests
When the Next.js frontend makes a request to the Express backend, it must include the API JWT (received during login) in the `Authorization` header. The backend validates this token before processing any request.

## Security Practices

- **Password Hashing:** Passwords are never stored in plain text. We utilize `argon2` for secure password hashing.
- **Session Tokens:** NextAuth stores session data in HTTP-only, secure cookies, mitigating XSS attacks.
- **Tenant Isolation:** Every user belongs to a specific `tenantId`. Backend queries are strictly scoped by this `tenantId` to prevent cross-tenant data leakage.
- **Rate Limiting (Planned):** Prevents brute-force attacks on the login and registration endpoints.

## Dependencies

- **Frontend:** `next-auth`, `zod` (validation)
- **Backend:** `jsonwebtoken`, `argon2`, `prisma`
