---
inclusion: always
---

# LeadCRM — Architecture Audit & Implementation Status

> **Stack:** Next.js 15 · Tailwind v4 · ShadCN · Node.js/Express · Prisma 5 · PostgreSQL
> **Monorepo:** Turborepo — `frontend/`, `backend/`, `shared/`

This document tracks what has been implemented, what remains, and what was intentionally deferred.

---

## ✅ IMPLEMENTED (Sprint 1–4 complete)

### Schema — New Entities Added to Prisma
| Entity | Notes |
|---|---|
| `Session` | Token revocation, forced logout. auth middleware now validates against DB. |
| `RoleDefinition` | Dynamic roles per tenant. `User.role` string kept as fallback during migration. |
| `UserRole` (junction) | User ↔ RoleDefinition many-to-many. |
| `TenantInvitation` | User onboarding to tenant via email token. |
| `Organization` | Company entity with typed FKs to contacts, deals, service orders, assets. |
| `ContactDeal` (junction) | Replaces `Deal.contactIds String[]`. Proper FK with cascade delete + role field. |
| `DealStageHistory` | Replaces `Deal.history JSON`. Queryable stage transitions with time tracking. |
| `Task` | Full task model with deal/contact FKs, reminders, assignment tracking. |
| `Activity` | Typed FKs (contactId, dealId, organizationId, taskId, invoiceId) — no polymorphic anti-pattern. |
| `Notification` | In-app notification persistence. |
| `CampaignContact` (junction) | Per-contact delivery + engagement tracking for campaigns. |
| `Template` | Email/SMS campaign templates. |
| `Invoice` | Full billing model with invoiceNumber, tax, discount, dueDate. |
| `PaymentTransaction` | PayMongo webhook receiver with idempotency via `paymongoPaymentId @unique`. |
| `ServiceOrder` | Replaced `clientName String` with `contactId FK`. Photos = URL only, no base64. |
| `Asset` | Added `organizationId FK`. |
| `InventoryItem` | Added to DB with tenant-scoped unique SKU. |
| `WorkflowTriggerRecord` | Workflow execution chain — level 1. |
| `WorkflowExecutionRun` | Workflow execution chain — level 2. |
| `WorkflowExecutionStep` | Workflow execution chain — level 3. |
| `EmailDeliveryLog` | Gmail send/open/click/bounce tracking. |

### Schema — Fields Added to Existing Entities
| Entity | Fields Added |
|---|---|
| `Tenant` | `subscriptionStatus`, `trialEndsAt`, `subscriptionEndsAt`, `maxUsers`, `maxContacts`, `maxDeals` |
| `User` | Multiple named relations (assignedContacts, ownedContacts, assignedDeals, etc.) |
| `Contact` | `organizationId`, `assignedUserId`, `ownerId`, `jobTitle`, `linkedinUrl`, `score`, `lastContactedAt`, `convertedAt`, `doNotContact`, `archiveReason`, `deletedAt`, `deletedBy` |
| `Pipeline` | `isDefault`, `currency`, `isArchived` |
| `Stage` | `probability`, `color`, `description`, `isWon`, `isLost`, `isDefault` |
| `Deal` | `organizationId`, `assignedUserId`, `ownerId`, `currency`, `closedAt`, `description`, `leadSource`, `archiveReason`, `deletedAt` |
| `Campaign` | `targetAudience`, `sentCount`, `openedCount`, `clickedCount`, `engagement`, `scheduledFor`, `isArchived` + new `MULTI_CHANNEL` / `SCHEDULED` enums |
| `Workflow` | `conditions Json?` (typed WorkflowCondition — never eval'd), `isArchived` |
| `AuditLog` | `changeset`, `ipAddress`, `userAgent`, `sessionId`, `severity` (all moved from [FE] to DB) |

### Composite Indexes Added
All high-traffic entities now have composite indexes on `tenantId + queryField`:
- Contact: status, assignedUserId, createdAt, isArchived, email
- Deal: stageId, pipelineId, assignedUserId, createdAt, isArchived
- AuditLog: createdAt, entityType+entityId, userId
- Task: assignedUserId+status, dueDate, dealId
- Session: userId+tenantId, tokenHash
- All other entities: tenantId+isArchived or tenantId+createdAt

### Security Hardening
- `helmet()` added to Express — all security headers set
- `HSTS` enforced in production
- CORS tightened to explicit `ALLOWED_ORIGINS` env list
- `authMiddleware` now async — validates JWT **and** Session table (token revocation)
- `Session.revokedAt` checked on every request — deactivated users lose access immediately
- `logout` now calls `revokeSession()` server-side before clearing cookie
- Body size limit: 1mb
- Auth rate limiter: 5 attempts / 15 min (was already in place)

### New Services Created
- `session.service.ts` — createSession, validateSession, revokeSession, revokeAllUserSessions, purgeExpiredSessions
- `audit.service.ts` — writeAuditLog (with changeset builder), fire-and-forget pattern
- `database.config.ts` — singleton Prisma, createTenantClient($extends), enforcePlanLimit

### Shared Package
- `api.contracts.ts` — ApiResponse, ApiError, PaginatedResponse, ListQueryParams
- `workflow.contracts.ts` — WorkflowCondition, WorkflowAction typed contracts

### Seeders Updated
- `admin.seed.ts` — returns Tenant for downstream seeders, uses new `subscriptionStatus` field
- `pipelines.seed.ts` — NEW: seeds all 4 default pipelines with stages, colors, isWon/isLost flags

---

## ⏳ REMAINING (not yet implemented — requires API layer work)

### API Endpoints Still Needed
All schema entities now have Prisma models but most lack controller/service/repository/route files.
Priority order (unblocks frontend integration):

1. **Organization CRUD** — contacts and deals depend on it
2. **Task CRUD** — core daily CRM operation
3. **Pipeline/Stage management API** — Client Admin configures pipelines
4. **Deal stage move** — must write DealStageHistory on every move, stamp closedAt when isWon/isLost
5. **User invitation flow** — TenantInvitation create → accept endpoint
6. **Notification CRUD** — mark read, list unread
7. **Invoice + PaymentTransaction** — PayMongo webhook handler with idempotency check
8. **CampaignContact** — campaign send, per-contact status updates

### Things Intentionally Deferred (not in scope yet)
- Territory, Product/DealLineItem, Webhook, ApiKey — future modules, no frontend yet
- CustomFieldDefinition/Value — no frontend form builder yet
- SmsDeliveryLog — Twilio not integrated
- KBArticle, Ticket — Customer Success phase
- pgvector / AI embeddings — AI phase
- BullMQ job queue — needed at Tier 2 (100+ users)
- Read replicas — needed at Tier 3 (1000+ users)

---

## ⚠️ IMPORTANT: Next Steps Before Running

### 1. Run DB Migration
```bash
cd backend
npm run db:migrate   # creates tables
npm run db:seed      # creates system admin + default pipelines
```

### 2. Deal Stage Move — Must Use isWon/isLost Flags
When implementing the deal stage-move service, **never** use `stage.name === "Closed Won"`.
Always use:
```typescript
const stage = await prisma.stage.findUnique({ where: { id: stageId } });
if (stage.isWon || stage.isLost) {
  await prisma.deal.update({ where: { id }, data: { closedAt: new Date() } });
}
```

### 3. Workflow Conditions — Never eval()
`Workflow.conditions` is a `WorkflowCondition` JSON object (see `shared/contracts/workflow.contracts.ts`).
The engine must parse and evaluate it as data — never pass it to `eval()` or dynamic query builders.

### 4. tenantId — Always from JWT
```typescript
// ✅ ALWAYS — tenantId from JWT
const contact = await prisma.contact.create({ data: { ...dto, tenantId: req.user.tenantId } });

// ❌ NEVER — tenantId from request body
const contact = await prisma.contact.create({ data: { ...req.body } });
```

### 5. User Deactivation — Must Revoke Sessions
When a Client Admin deactivates a user:
```typescript
import { revokeAllUserSessions } from '../core/auth/session.service';
await prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
await revokeAllUserSessions(userId); // ← required — kicks user out immediately
```

---

## What Was Corrected vs. the Claude Document

| Claude Said | Correction Applied |
|---|---|
| "Next.js 16" | Project uses Next.js 15 — corrected in this doc |
| `$use` Prisma middleware (deprecated) | Used `$extends` (Prisma 5 correct API) |
| Drop `User.role` string entirely | Kept as fallback — JWT payload still carries it; UserRole junction added alongside |
| `TenantStatus.DELETED` replaces `CANCELLED` | Added `DELETED` as new value, kept `CANCELLED` for backwards compat |
| Territory, Product, Webhook, ApiKey, AI embeddings | Deferred — no frontend, no business need yet |
| Activity polymorphic `relatedToType + relatedToId` | Replaced with typed FK columns (contactId, dealId, organizationId, taskId, invoiceId) |
