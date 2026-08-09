# LeadCRM - Tenant Mismatch Issue Resolution

**Date**: August 9, 2026  
**Issue**: Leads not displaying in Client Profiles page despite existing in database  
**Status**: ✅ **RESOLVED**

---

## Problem Summary

### Symptoms

- Frontend showed "0 total" and "No profiles found matching your criteria"
- Database had 2 Lead records visible in pgAdmin
- User was logged in and authenticated correctly

### Root Cause

**Tenant ID Mismatch** between logged-in user and Lead records.

**The Issue**:

- Lead records had `tenantId: 'a3543600-e623-4774-ae21-da85f98081c2'` (Demo Sandbox tenant)
- Logged-in user had `tenantId: 'bfdc9e60-cd37-4748-a05a-a29998ef8168'` (Kulas - Stokes tenant)
- Backend API filters ALL queries by `req.user.tenantId` (enforced by `tenantMiddleware`)
- Result: User could never see those Lead records because they belonged to a different tenant

---

## How Multi-Tenancy Works in LeadCRM

### Tenant Isolation Architecture

1. **Authentication Layer** (`auth.middleware.ts`):
   - JWT token contains: `userId`, `tenantId`, `role`, `email`
   - Token stored in HttpOnly cookie (`leadcrm_token`)
   - Every request extracts `req.user` from JWT

2. **Tenant Middleware** (`tenant.middleware.ts`):
   - Enforces `req.user.tenantId` exists on all protected routes
   - Blocks requests without valid tenant context

3. **Repository Layer** (e.g., `leads.repository.ts`):

   ```typescript
   const where = {
     tenantId,  // ALWAYS scoped to tenant
     // ... other filters
   };

   prisma.lead.findMany({ where, ... })
   ```

   - Every query MUST include `tenantId` filter
   - Cross-tenant data access is impossible by design

### Why This Prevents Cross-Tenant Data Leaks

- User A (Tenant X) can NEVER see data from Tenant Y
- Even if User A knows the ID of a Lead in Tenant Y, the query will return 404
- Database-level isolation ensures no accidental data exposure

---

## Diagnostic Process

### Step 1: Identify the Issue

Created diagnostic script: `src/scripts/diagnose-leads-issue.ts`

**Findings**:

```
Source Tenant: Demo Sandbox (a3543600-e623-4774-ae21-da85f98081c2)
   Users: 0
   Leads: 2
      - Durussy Y (durussy1@gmail.com) - warm
      - Julie Ann Tiron (jtiron2004@gmail.com) - hot

Target Tenant: Kulas - Stokes (bfdc9e60-cd37-4748-a05a-a29998ef8168)
   Users: 9
   Leads: 0
```

**Problem Identified**: Leads exist in a tenant with no users; Users exist in a tenant with no leads.

### Step 2: Verify Data Flow

Traced complete path from database to UI:

1. Frontend: `/crm/leads` → `leads-page.tsx`
2. Data Loading: `DataContext.tsx` → `contactsService.getAll()`
3. API Call: `GET /api/v1/crm/leads?limit=500` (with `credentials: 'include'`)
4. Backend: `authMiddleware` → `tenantMiddleware` → `authorize('contacts.view')` → controller
5. Repository: `prisma.lead.findMany({ where: { tenantId }, ... })`

**Result**: Backend returned `[]` because logged-in user's `tenantId` didn't match Lead records.

---

## Resolution

### Created Fix Script

`src/scripts/fix-leads-tenant.ts` - Safely updates Lead records to target tenant.

**Execution**:

```bash
npx tsx src/scripts/fix-leads-tenant.ts --confirm
```

**Operation**:

- Moved 2 Lead records from Demo Sandbox → Kulas - Stokes
- Updated `Lead.tenantId` for all matching records
- Verified: Source tenant now has 0 leads, Target tenant has 2 leads

**Result**: ✅ Leads now display correctly in Client Profiles page

---

## How This Happened

### Campaign Test Script Created Orphaned Tenant

When running the campaign E2E test (`test-campaign-e2e.ts`), test leads were created with:

```typescript
const TENANT_ID = "a3543600-e623-4774-ae21-da85f98081c2"; // Demo Sandbox
const USER_ID = "93fbda91-d913-43f1-9252-09d40ba29ccb";
```

This tenant/user combo was used for **campaign testing**, but the user was logged into the **frontend** with a different tenant (`bfdc9e60-cd37-4748-a05a-a29998ef8168`).

**Why it happened**:

1. Campaign test created leads in Demo Sandbox tenant (for email testing)
2. User logged into frontend with a seeded user from Kulas - Stokes tenant
3. Frontend queried for leads using Kulas - Stokes `tenantId`
4. Backend correctly returned empty array (tenant isolation working as designed)

---

## Prevention Guidelines

### 1. Always Verify Tenant Context in Tests

When creating test scripts that insert data:

```typescript
// BAD - Hardcoded tenant ID
const TENANT_ID = "a3543600-e623-4774-ae21-da85f98081c2";

// GOOD - Get from actual logged-in user
const user = await prisma.user.findFirst({
  where: { email: "admin@kulas---stokes-9.com" },
});
const TENANT_ID = user.tenantId;
```

### 2. Use Diagnostic Script Regularly

```bash
npx tsx src/scripts/diagnose-leads-issue.ts
```

Run this script if:

- Data exists in database but not showing in UI
- User reports "no data" but you can see records in pgAdmin
- After running seed scripts or test scripts

### 3. Cleanup Test Data

Test scripts should clean up after themselves:

```typescript
// At end of test
if (process.argv.includes("--cleanup")) {
  await prisma.lead.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.targetAudience.delete({ where: { id: audienceId } });
  await prisma.campaign.delete({ where: { id: campaignId } });
}
```

### 4. Document Tenant IDs

Keep track of which tenants are used for what:

```typescript
// backend/src/scripts/README.md
const TENANTS = {
  PRODUCTION: "prod-tenant-id",
  DEMO_SANDBOX: "a3543600-e623-4774-ae21-da85f98081c2", // For campaign tests
  KULAS_STOKES: "bfdc9e60-cd37-4748-a05a-a29998ef8168", // For UI testing
};
```

---

## Common Scenarios

### Scenario 1: "I seeded data but it's not showing"

**Cause**: Seeder used a different tenant than logged-in user  
**Fix**: Run diagnostic script, then use fix script to move data to correct tenant

### Scenario 2: "Production data not showing after migration"

**Cause**: Migration created new tenant IDs, but user JWT still has old tenant ID  
**Fix**: Users must log out and log back in to get fresh JWT with correct tenant ID

### Scenario 3: "Test data showing in production"

**Cause**: Test script used production tenant ID  
**Fix**: Always use separate test tenants, never share tenant IDs between test and production

---

## Verification Checklist

After fixing tenant mismatch:

- [ ] Run diagnostic script - no orphaned tenants
- [ ] Log into frontend - data displays correctly
- [ ] Check browser console - no 404 or 403 errors
- [ ] Verify tenant ID in JWT matches database records
- [ ] Test CRUD operations - all working

---

## Related Files

### Diagnostic & Fix Scripts

- `backend/src/scripts/diagnose-leads-issue.ts` - Tenant mismatch diagnostic
- `backend/src/scripts/fix-leads-tenant.ts` - Move leads between tenants

### Tenant Isolation Implementation

- `backend/src/api/middleware/auth.middleware.ts` - JWT extraction
- `backend/src/api/middleware/tenant.middleware.ts` - Tenant enforcement
- `backend/src/modules/crm/leads/leads.repository.ts` - Query filtering

### Frontend Data Flow

- `frontend/src/store/DataContext.tsx` - Data loading
- `frontend/src/lib/api/leads.service.ts` - API calls
- `frontend/src/features/tenant/crm/leads/ui/leads-page.tsx` - UI component

---

## Key Takeaways

1. **Multi-tenancy is working correctly** - This was not a bug, but a data issue
2. **Tenant isolation prevents data leaks** - Cross-tenant queries return empty, not error
3. **Test data must match logged-in user's tenant** - Always verify tenant context
4. **Diagnostic tools are essential** - Created reusable scripts for future issues

---

**Resolution Date**: August 9, 2026  
**Resolution Time**: ~15 minutes  
**Impact**: 0 users affected (development environment)  
**Status**: ✅ RESOLVED
