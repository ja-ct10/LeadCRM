# Entity Relationship Diagram — LeadCRM

## Overview

All entities are scoped to a `Tenant`. No cross-tenant data access is possible. Source of truth: `backend/prisma/schema.prisma`.

---

## Relationship Diagram

```
Tenant (1)
  │
  ├──(n) User
  │
  ├──(n) Contact
  │         │
  │         └──(n) Deal ──────────────────────────────────┐
  │                  │                                     │
  │                  ├── history[]:    StageHistoryEntry[] │
  │                  │   ├── stageId                       │
  │                  │   ├── previousStageId               │
  │                  │   ├── timestamp                     │
  │                  │   └── userId                        │
  │                  │                                     │
  │                  ├── activities[]: DealActivity[]       │
  │                  │   ├── type (call/email/meeting/note) │
  │                  │   ├── description                    │
  │                  │   ├── timestamp                      │
  │                  │   └── userId                         │
  │                  │                                     │
  │                  └── Task(n) ───────────────────────── │
  │                       ├── assignedUserId               │
  │                       ├── assignedBy                   │
  │                       ├── status (5 values)            │
  │                       ├── dueDate                      │
  │                       └── assignmentHistory[]          │
  │                           ├── assignedTo               │
  │                           ├── assignedBy               │
  │                           ├── assignedAt               │
  │                           ├── previousAssignee         │
  │                           └── reason                   │
  │
  ├──(n) Pipeline
  │         │
  │         └──(n) Stage
  │                   │
  │                   └──(n) Deal ◄──────────────────────── (same Deal above)
  │
  ├──(n) Campaign
  │
  ├──(n) Workflow
  │
  └──(n) AuditLog
            ├── userId
            ├── action
            ├── entityType
            ├── entityId
            └── metadata (JSON changeset)
```

---

## Entity Definitions

### Tenant
```
id          String  (cuid, PK)
name        String
slug        String  (unique)
status      SANDBOX | ACTIVE | SUSPENDED | CANCELLED
plan        FREE | PRO | ENTERPRISE
createdAt   DateTime
updatedAt   DateTime
```
**Parent of:** User, Contact, Deal, Pipeline, Campaign, Workflow, AuditLog

---

### User
```
id           String  (cuid, PK)
tenantId     String  (FK → Tenant) ← REQUIRED
email        String  (unique per tenant)
firstName    String
lastName     String
passwordHash String
role         String  (Client Admin | Sales Rep | Viewer | Technician)
status       ACTIVE | INACTIVE | PENDING
createdAt    DateTime
updatedAt    DateTime
```

---

### Contact
```
id         String  (cuid, PK)
tenantId   String  (FK → Tenant) ← REQUIRED
firstName  String
lastName   String
email      String?
phone      String?
company    String?
status     HOT | WARM | COLD | CANCELLED | CLOSED
source     String?
notes      String?
isArchived Boolean
createdAt  DateTime
updatedAt  DateTime
```
**Parent of:** Deal (via contactId)

---

### Pipeline
```
id        String  (cuid, PK)
tenantId  String  (FK → Tenant) ← REQUIRED
name      String
createdAt DateTime
updatedAt DateTime
```
**Parent of:** Stage, Deal

**Default pipelines:**
- Sales Inquiries
- Technical Support
- Project Implementation
- After-Sales Concerns

---

### Stage
```
id         String  (cuid, PK)
pipelineId String  (FK → Pipeline)
name       String
order      Int
createdAt  DateTime
```
**Parent of:** Deal

---

### Deal
```
id          String  (cuid, PK)
tenantId    String  (FK → Tenant) ← REQUIRED
pipelineId  String  (FK → Pipeline)
stageId     String  (FK → Stage)
contactId   String? (FK → Contact) ← link to CRM contact
title       String
value       Float?
priority    LOW | MEDIUM | HIGH
createdAt   DateTime
updatedAt   DateTime

-- Frontend-only fields (localStorage phase, to be migrated):
companyName     String
contactPerson   String
assignedUserId  String
expectedCloseDate String
description     String
lostReason      String?
leadSource      String?
industry        String?
location        String?
campaign        String?
customerType    String?
tags            String?
isArchived      Boolean
history[]       StageHistoryEntry[]
activities[]    DealActivity[]
```
**Parent of:** Task (via dealId)

---

### Task
```
id              String  (cuid, PK)
tenantId        String  (FK → Tenant) ← REQUIRED
dealId          String? (FK → Deal)
title           String
description     String
status          pending | in-progress | blocked | completed | cancelled
dueDate         String
assignedUserId  String  (FK → User)
assignedBy      String? (FK → User)
priority        LOW | MEDIUM | HIGH
createdAt       DateTime

assignmentHistory[]  TaskAssignmentRecord[]
  ├── assignedTo       String (userId)
  ├── assignedBy       String (userId)
  ├── assignedAt       String (ISO timestamp)
  ├── previousAssignee String? (userId)
  └── reason           String?
```

---

### Campaign
```
id        String  (cuid, PK)
tenantId  String  (FK → Tenant) ← REQUIRED
name      String
type      EMAIL | SMS
status    DRAFT | ACTIVE | PAUSED | COMPLETED
subject   String?
body      String?
sentAt    DateTime?
createdAt DateTime
updatedAt DateTime
```

---

### Workflow
```
id          String  (cuid, PK)
tenantId    String  (FK → Tenant) ← REQUIRED
name        String
description String?
trigger     String  (e.g. 'lead_created', 'deal_stage_proposal')
actions     Json    (array of WorkflowAction objects)
isActive    Boolean
createdAt   DateTime
updatedAt   DateTime
```

---

### AuditLog
```
id         String  (cuid, PK)
tenantId   String  (FK → Tenant) ← REQUIRED
userId     String  (FK → User)
action     String  (e.g. 'Deal Updated', 'Contact Created')
entityType String  (e.g. 'Deal', 'Contact', 'Task')
entityId   String?
metadata   Json?   (changeset: { field: { old, new } })
createdAt  DateTime
```

---

## Key Relationships

| Relationship | Cardinality | FK Field |
|---|---|---|
| Tenant → User | 1:N | `User.tenantId` |
| Tenant → Contact | 1:N | `Contact.tenantId` |
| Tenant → Pipeline | 1:N | `Pipeline.tenantId` |
| Pipeline → Stage | 1:N | `Stage.pipelineId` |
| Pipeline → Deal | 1:N | `Deal.pipelineId` |
| Stage → Deal | 1:N | `Deal.stageId` |
| Contact → Deal | 1:N | `Deal.contactId` (nullable) |
| Deal → Task | 1:N | `Task.dealId` (nullable) |
| Tenant → AuditLog | 1:N | `AuditLog.tenantId` |
| User → AuditLog | 1:N | `AuditLog.userId` |

---

## Tenant Isolation Guarantee

Every table has `tenantId` as a required field. The repository layer enforces:

```typescript
// Example — every query is scoped
prisma.contact.findMany({ where: { tenantId: req.user.tenantId } })
```

`tenantId` is sourced from the JWT only — never from the request body.

---

## Migration Path (localStorage → PostgreSQL)

The frontend mock data structure maps directly to this schema:

| Frontend (`store/types/`) | Prisma Model |
|---|---|
| `Contact` | `Contact` |
| `Deal` | `Deal` |
| `Pipeline` | `Pipeline` |
| `Stage` | `Stage` |
| `Task` | `Task` (+ `TaskAssignmentRecord` as JSON column) |
| `Campaign` | `Campaign` |
| `Workflow` | `Workflow` |
| `AuditLog` | `AuditLog` |

When `NEXT_PUBLIC_USE_MOCK_DATA=false`, only `DataContext.tsx` internals change. No component rewrites required.

---

## See Also
- `backend/prisma/schema.prisma` — canonical Prisma schema
- [permission-matrix.md](../security/permission-matrix.md)
- [customer-lifecycle.md](../workflows/customer-lifecycle.md)
