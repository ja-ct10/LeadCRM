# LeadCRM ERD — Summary & Recommendations

**Generated:** June 25, 2026  
**Interactive HTML ERD:** `docs/database/erd.html` (open in browser)

---

## 📊 Overview

**Total Entities:** 18  
**In Prisma Schema (DB):** 8 entities  
**Frontend Only (needs migration):** 10 entities  
**Recommended Additions:** 3 structural improvements  

---

## ✅ What's Working Well

1. **Multi-tenancy is correctly enforced** — every entity has `tenantId` FK
2. **Core CRM flow is solid** — Tenant → User → Contact → Pipeline → Deal chain works
3. **Audit logging exists** — AuditLog captures all state changes
4. **Workflow foundation is in place** — Workflow model exists in DB

---

## 🔴 Critical Recommendations

### 1. **Add Composite Indexes on tenantId + Query Fields** (HIGH PRIORITY)
**Why:** Every query filters by `tenantId`. Without indexes, PostgreSQL does full table scans at scale.

**Impact:** Query performance degrades from O(n) to O(log n). Critical for `Contact`, `Deal`, `AuditLog`.

**Fix:**
```prisma
model Contact {
  // ... existing fields
  @@index([tenantId, createdAt])
  @@index([tenantId, status])
  @@index([tenantId, email])
  @@index([tenantId, assignedUserId])
}
```

Apply same pattern to: `Deal`, `AuditLog`, `Campaign`, `Workflow`, `User`.

---

### 2. **Separate User.role String → UserRole Junction Table** (HIGH PRIORITY)
**Why:** Current schema stores role as a string. This prevents:
- Dynamic role creation by Client Admins
- Multi-role assignment (e.g., user is both Sales Rep AND Technician)
- Permission changes without updating every User record

**Fix:** Create many-to-many relationship:
```
User ←→ UserRole ←→ RoleDefinition
```

**Benefit:** Client Admins can create custom roles via UI. Single source of truth for permissions.

---

### 3. **Add Soft Delete Fields Instead of Just isArchived** (HIGH PRIORITY)
**Why:** `isArchived` conflates user-initiated hiding with data deletion (GDPR compliance).

**Better pattern:**
```prisma
isArchived    Boolean   @default(false)  // user hides from UI (reversible)
deletedAt     DateTime?                  // hard delete timestamp (GDPR)
deletedBy     String?                    // FK→User (audit who deleted)
archiveReason String?                    // why was it archived/deleted
```

**Benefit:** GDPR "right to be forgotten" compliance + complete audit trail.

---

### 4. **Change Deal.contactIds JSON Array → ContactDeal Junction Table** (MEDIUM PRIORITY)
**Why:** Storing FKs as JSON arrays prevents:
- Foreign key constraints (data integrity)
- Efficient JOINs (can't query "all deals for contact X")
- Relationship metadata (when was contact added? by whom? what role?)

**Fix:**
```prisma
model ContactDeal {
  id         String   @id @default(cuid())
  contactId  String
  dealId     String
  tenantId   String
  role       String?  // "Primary Contact" | "Decision Maker" | "Influencer"
  addedBy    String?  // FK→User
  addedAt    DateTime @default(now())
  contact    Contact  @relation(fields: [contactId], references: [id])
  deal       Deal     @relation(fields: [dealId], references: [id])
  @@unique([contactId, dealId])
}
```

---

### 5. **Add Contact.ownerId Separate from assignedUserId** (MEDIUM PRIORITY)
**Why:** 
- `assignedUserId` = who's working on this lead right now (can change)
- `ownerId` = who originally captured this lead (never changes)

**Use case:** Sales Rep A captures lead → reassigned to Rep B → Rep B closes deal → **who gets commission credit?**

Without `ownerId`, you can't track lead source attribution.

**Fix:**
```prisma
assignedUserId   String?  // current handler (can change)
ownerId          String   // original capturer (immutable)
ownershipHistory JSON?    // [{assignedTo, assignedBy, assignedAt, reason}]
```

---

### 6. **Add Tenant.subscriptionStatus Separate from Tenant.status** (MEDIUM PRIORITY)
**Why:** `Tenant.status` conflates approval state with billing state.

**Current problem:** A tenant can be `ACTIVE` (approved by System Admin) but have an overdue payment.

**Better:**
```prisma
status             TenantStatus         // SANDBOX | ACTIVE | SUSPENDED (approval)
subscriptionStatus SubscriptionStatus  // TRIAL | ACTIVE | PAST_DUE | CANCELLED (billing)
trialEndsAt        DateTime?
subscriptionEndsAt DateTime?
```

**Benefit:** System Admin controls access, PayMongo webhooks control billing — clear separation of concerns.

---

### 7. **Add AuditLog.ipAddress and .userAgent for Security** (MEDIUM PRIORITY)
**Why:** Security incidents require context:
- Detect anomalous login locations
- Identify bot vs. human activity
- GDPR compliance (track who accessed what from where)

**Fix:**
```prisma
ipAddress  String?  // req.ip
userAgent  String?  // req.headers['user-agent']
sessionId  String?  // track session context
```

**Storage cost:** ~50 bytes per log. Worth it for forensics.

---

## 🟡 Medium Priority Improvements

| Improvement | Why | Effort |
|---|---|---|
| Add `Stage.color` field | Let Client Admins customize pipeline colors per tenant | 10 min |
| Add `Campaign.scheduledFor` | Allow scheduling campaigns in advance | 30 min |
| Add `Deal.closedAt` timestamp | Separate from `updatedAt` — critical for sales velocity metrics | 10 min |
| Add `Contact.leadScore` algorithm | Auto-calculate score based on engagement, not just status | 2 hours |

---

## 📋 Migration Backlog (Frontend → DB)

These entities exist in `frontend/src/store/types/` but not in Prisma schema. Must migrate before `USE_MOCK_DATA=false`.

| Entity | Priority | Blocked By | Effort |
|---|---|---|---|
| **Organization** | HIGH | Contact.organizationId FK | 2–3 hours |
| **Task** | HIGH | Deal → Task 1:N required | 2 hours |
| **Activity** | HIGH | Unified timeline (polymorphic FK) | 3 hours |
| **WorkflowTriggerRecord** | HIGH | 3-level execution chain visibility | 4 hours (3 tables) |
| **WorkflowExecutionRun** | HIGH | Same as above | — |
| **WorkflowExecutionStep** | HIGH | Same as above | — |
| **RoleDefinition** | MEDIUM | RBAC dynamic roles | 2 hours |
| **Invoice** | MEDIUM | Can defer if PayMongo handles all billing | 2 hours |
| **Template** | MEDIUM | Campaign email/SMS templates | 1 hour |
| **ServiceOrder** | MEDIUM | Operations module | 2 hours |
| **Asset** | LOW | Not MVP | 1.5 hours |
| **InventoryItem** | LOW | Not MVP | 1.5 hours |

**Total effort for HIGH priority migrations:** ~13 hours

---

## 🔄 Lead → Deal Flow (Current State)

```
1. Lead Capture
   └→ Contact created (status=WARM, score=75)
   └→ AuditLog: contact.created

2. Lead Qualification
   └→ Sales Rep promotes to status=HOT (score=95)
   └→ Workflow may trigger: "Welcome Email", "Schedule Follow-up Task"

3. Deal Creation
   └→ Deal linked to Contact, Pipeline (Sales Inquiries), Stage (Discovery)
   └→ Deal.history initialized: [{stageId, timestamp}]

4. Stage Progression
   └→ Drag deal across stages: Discovery → Assessment → Proposal → Negotiation
   └→ Each move appends: {stageId, previousStageId, timestamp, userId}
   └→ Workflow engine evaluates deal.stage_changed triggers

5A. Deal Won
   └→ Deal.stageId = "Closed Won"
   └→ Contact.status = CLOSED
   └→ Sales Rep clicks "Convert to Invoice" → Invoice record created
   └→ Optional: trigger onboarding workflow

5B. Deal Lost
   └→ Deal.stageId = "Closed Lost"
   └→ Lost Reason modal (required) → Deal.lostReason
   └→ Contact.status = COLD or CANCELLED
```

---

## 🔐 RBAC Summary

**5 System Roles:**
- **System Admin** — platform-wide access (Admin Portal)
- **Client Admin** — full tenant access (CRM Portal)
- **Sales Rep** — contacts.*, deals.*, campaigns.view, workflows.view
- **Technician** — contacts.view, deals.view (read-only)
- **Viewer** — *.view (all modules read-only)

**Permission enforcement:**
- Middleware: `rbac.middleware.ts` checks `DEFAULT_ROLE_PERMISSIONS`
- Frontend: `hasPermission(user, Permission.CONTACTS_CREATE)`
- Shared: `@leadcrm/shared` — canonical permission registry

**Dynamic custom roles:** Requires `RoleDefinition` + `UserRole` junction table migration.

---

## 🎯 Next Steps

1. **Open `docs/database/erd.html` in browser** — interactive diagram with 6 tabs
2. **Review Recommendations tab** — 10 improvements with code examples
3. **Prioritize HIGH priority fixes** — indexes, UserRole junction, soft delete
4. **Plan migration sprint** — Organization + Task + Activity (13 hours total)
5. **Update Prisma schema** — apply recommendations incrementally
6. **Run `npm run db:migrate`** — generate and apply migrations
7. **Update seeders** — ensure all new fields have default values

---

## 📚 Related Docs

- `docs/database/erd.html` — **Interactive HTML ERD (open this first!)**
- `docs/database/erd.md` — Text version of ERD
- `backend/prisma/schema.prisma` — Current DB schema (source of truth)
- `docs/ARCHITECTURE.md` — System architecture overview
- `docs/security/permission-matrix.md` — RBAC role × module matrix
- `docs/workflows/lead-to-deal.md` — Lead lifecycle workflow

---

**Questions? Open the HTML ERD and explore the tabs. All 18 entities, relationships, and recommendations are documented there.**
