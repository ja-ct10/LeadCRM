# Entity Relationship Diagram — LeadCRM

> **Sources of truth:**
> - DB schema: `backend/prisma/schema.prisma`
> - Frontend types: `frontend/src/store/types/`
>
> The Prisma schema represents the *current DB state*.
> Frontend types represent the *target migrated state* (includes fields not yet in DB).
> Fields marked `[DB]` exist in Prisma. Fields marked `[FE]` exist only in frontend localStorage phase.

---

## Full Entity Map

```
Tenant (1)
  │
  ├──(n) User
  │         └──(n) AuditLog
  │
  ├──(n) Organization
  │         │
  │         └──(n) Contact ◄──────────────────────────────────────────────────┐
  │                   │                                                        │
  │                   └──(n) Deal ─────────────────────────────────────────── │
  │                              │                                             │
  │                              ├── history[]: StageHistoryEntry[]            │
  │                              ├── activities[]: DealActivity[]              │
  │                              ├── ownershipHistory[]: DealOwnershipRecord[] │
  │                              ├──(n) Task                                   │
  │                              │       └── assignmentHistory[]:              │
  │                              │           TaskAssignmentRecord[]            │
  │                              └──(n) Invoice                                │
  │                                                                            │
  ├──(n) Pipeline                                                              │
  │         └──(n) Stage ──────────────────── Deal.stageId ───────────────────┘
  │
  ├──(n) Campaign
  │
  ├──(n) Template
  │
  ├──(n) Workflow
  │         └──(n) WorkflowTriggerRecord
  │                   └──(n) WorkflowExecutionRun
  │                             └──(n) WorkflowExecutionStep
  │
  ├──(n) Activity (unified timeline — links to any entity)
  │
  ├──(n) ServiceOrder ──── assigned Technician (User)
  │
  ├──(n) Asset
  │
  ├──(n) InventoryItem
  │
  ├──(n) RoleDefinition ──── permissions: string[]
  │
  └──(n) AuditLog
```

---

## Entity Definitions

### Tenant `[DB]`
```
id              String   UUID / cuid (PK)
name            String
slug            String   (unique)
status          SANDBOX | ACTIVE | SUSPENDED | CANCELLED
plan            FREE | PRO | ENTERPRISE
industry        String   [FE]
size            String   [FE]
email           String   [FE]
phone           String   [FE]
address         String   [FE]
timezone        String?  [FE]
currency        String?  [FE]
domain          String?  [FE]
approvalStep    basic | requirements | completed  [FE]
environment     none | sandbox | production | both  [FE]
adminNotes      String?  [FE]
businessReqs    JSON?    [FE]  { requirements, documentName? }
verificationDocs JSON?   [FE]  { businessPermit?, taxId?, validId?, uploadedAt }
healthMetrics   JSON?    [FE]  { cpuUsage, memoryUsage, storageUsage, uptime, status, lastCheck }
createdAt       DateTime
updatedAt       DateTime
```

---

### User `[DB]`
```
id              String   UUID (PK)
tenantId        String   (FK → Tenant) REQUIRED
firstName       String
lastName        String
email           String   (unique per tenant)
passwordHash    String
phone           String?  [FE]
org             String?  [FE]
team            String?  [FE]
role            Client Admin | Sales Rep | Viewer | Technician | System Admin
status          active | pending | inactive
lastLogin       DateTime? [FE]
isArchived      Boolean   [FE]
createdAt       DateTime
updatedAt       DateTime
```

---

### Organization `[FE — not yet in DB]`
```
id              String   UUID (PK)
tenantId        String   (FK → Tenant) REQUIRED
name            String
industry        String?
size            String?
website         String?
taxId           String?
assignedUserId  String?  (FK → User)
tags            String[]
address         String?
city            String?
province        String?
country         String?
postalCode      String?
isArchived      Boolean
createdAt       DateTime
```
**Migration note:** Add `Organization` model to Prisma before contacts are linked to companies.

---

### Contact `[DB — partial]`
```
id              String   UUID (PK)
tenantId        String   (FK → Tenant) REQUIRED
organizationId  String?  (FK → Organization) [FE]
companyName     String
contactPerson   String
jobTitle        String
email           String
phone           String
firstName       String?  [FE]
middleName      String?  [FE]
lastName        String?  [FE]
displayName     String?  [FE]
preferredName   String?  [FE]
secondaryEmail  String?  [FE]
workEmail       String?  [FE]
mobileNumber    String?  [FE]
altPhone        String?  [FE]
department      String?  [FE]
website         String?  [FE]
linkedin        String?  [FE]
facebook        String?  [FE]
gender          String?  [FE]
dateOfBirth     String?  [FE]
serviceRequired String
leadSource      String
estimatedValue  Float
assignedUserId  String   (FK → User)
assignedTeam    String?  [FE]
ownerId         String?  (FK → User) [FE]
expectedCloseDate DateTime
status          Hot | Warm | Cold | Cancelled | Closed
score           Int
customerType    Individual | Organization  [FE]
callStatus      String?  [FE]
priority        Low | Medium | High | Critical  [FE]
businessType    String?  [FE]
companySize     String?  [FE]
tags            String?  [FE]
notes           String
internalNotes   String?  [FE]
customFields    JSON?    [FE]
contactNumbers  JSON?    [FE]  [{ id, type, countryCode, number, notes }]
country         String?  [FE]
region          String?  [FE]
province        String?  [FE]
city            String?  [FE]
barangay        String?  [FE]
postalCode      String?  [FE]
streetAddress   String?  [FE]
isArchived      Boolean
archivedAt      DateTime? [FE]
archivedBy      String?   (FK → User) [FE]
archiveReason   String?   [FE]
createdAt       DateTime
updatedAt       DateTime
```

---

### Pipeline `[DB]`
```
id          String   UUID (PK)
tenantId    String   (FK → Tenant) REQUIRED
name        String
isArchived  Boolean  [FE]
createdAt   DateTime
updatedAt   DateTime
```
**Default pipelines:** Sales Inquiries · Technical Support · Project Implementation · After-Sales Concerns

---

### Stage `[DB]`
```
id           String   UUID (PK)
pipelineId   String   (FK → Pipeline)
name         String
order        Int
probability  Int?     [FE]  0–100 — used for weighted revenue forecast
createdAt    DateTime
```

---

### Deal `[DB — partial]`
```
id                  String   UUID (PK)
tenantId            String   (FK → Tenant) REQUIRED
pipelineId          String   (FK → Pipeline)
stageId             String   (FK → Stage)
contactId           String?  (FK → Contact) — legacy singular
contactIds          String[] [FE]  all stakeholder contacts (replaces singular contactId)
companyId           String?  (FK → Organization) [FE]
organizationId      String?  (FK → Organization) [FE]
title               String
companyName         String
contactPerson       String
value               Float
priority            Low | Medium | High
expectedCloseDate   DateTime
description         String
assignedUserId      String   (FK → User)
lostReason          String?
leadSource          String?
industry            String?
location            String?
campaign            String?
customerType        String?
tags                String?
lastStageChangeDate DateTime? [FE]
isArchived          Boolean
archivedAt          DateTime? [FE]
archivedBy          String?   [FE]
archiveReason       String?   [FE]
customFields        JSON?     [FE]
history             JSON?     [FE]  StageHistoryEntry[]
activities          JSON?     [FE]  DealActivity[]
ownershipHistory    JSON?     [FE]  DealOwnershipRecord[]
order               Int
createdAt           DateTime
updatedAt           DateTime
```

#### StageHistoryEntry (embedded JSON on Deal)
```
stageId          String  (FK → Stage)
previousStageId  String? (FK → Stage) — the stage before this move
timestamp        String  ISO
userId           String  (FK → User)
note             String?
```

#### DealOwnershipRecord (embedded JSON on Deal)
```
assignedTo    String  (FK → User)
assignedBy    String  (FK → User) or 'system'
assignedAt    String  ISO
reason        String? e.g. "Territory Transfer"
```

---

### Task `[FE — not yet in DB]`
```
id                  String   UUID (PK)
tenantId            String   (FK → Tenant) REQUIRED
dealId              String?  (FK → Deal)
title               String
description         String
status              pending | in-progress | blocked | completed | cancelled
dueDate             DateTime
assignedUserId      String   (FK → User)
assignedBy          String?  (FK → User)
priority            Low | Medium | High
assignmentHistory   JSON?    TaskAssignmentRecord[]
createdAt           DateTime
```

#### TaskAssignmentRecord (embedded JSON on Task)
```
assignedTo        String  (FK → User)
assignedBy        String  (FK → User)
assignedAt        String  ISO
previousAssignee  String? (FK → User)
reason            String?
```

---

### Invoice `[FE — not yet in DB]`
```
id              String   UUID (PK)
tenantId        String   (FK → Tenant) REQUIRED
dealId          String?  (FK → Deal)
contactId       String?  (FK → Contact)
companyName     String
plan            String
amount          Float
frequency       Monthly | Quarterly | Annual | One-time
status          Active | Pending Renewal | Expired | Cancelled
startDate       DateTime
nextBillingDate DateTime
paymentStatus   Paid | Unpaid | Overdue
isArchived      Boolean
createdAt       DateTime
```

---

### Campaign `[DB]`
```
id              String   UUID (PK)
tenantId        String   (FK → Tenant) REQUIRED
name            String
description     String?
type            Email | SMS | Multi-Channel
status          active | completed | scheduled | paused | Draft
targetAudience  String
sentCount       Int
openedCount     Int?
clickedCount    Int?
engagement      Float
isArchived      Boolean
createdAt       DateTime
updatedAt       DateTime
```

---

### Template `[FE — not yet in DB]`
```
id          String   UUID (PK)
tenantId    String   (FK → Tenant) REQUIRED
name        String
type        Email | SMS
category    String
subject     String?
content     String
isArchived  Boolean
```

---

### Workflow `[DB]`
```
id              String   UUID (PK)
tenantId        String   (FK → Tenant) REQUIRED
name            String
description     String?
category        Security | Telecom | IT | General  [FE]
trigger         String   e.g. 'contact.created', 'deal.stage_changed'
condition       String?  [FE]
action          String?  [FE]  (legacy single action)
actions         JSON     WorkflowAction[]
actionConfig    JSON?    [FE]
delay           Int?     [FE]
delayUnit       minutes | hours | days  [FE]
status          active | paused
executionCount  Int      [FE]
isActive        Boolean  [DB]
isArchived      Boolean  [FE]
createdAt       DateTime
updatedAt       DateTime
```

---

### WorkflowTriggerRecord `[FE — not yet in DB]`
```
id           String   UUID (PK)
tenantId     String   (FK → Tenant) REQUIRED
workflowId   String   (FK → Workflow)
triggerType  String   e.g. 'contact.created'
entityType   String   e.g. 'Contact', 'Deal'
entityId     String
triggeredAt  DateTime
payload      JSON
```

---

### WorkflowExecutionRun `[FE — not yet in DB]`
```
id            String   UUID (PK)
tenantId      String   (FK → Tenant) REQUIRED
workflowId    String   (FK → Workflow)
workflowName  String
triggerId     String   (FK → WorkflowTriggerRecord)
entityType    String
entityId      String
status        running | completed | failed | skipped
startedAt     DateTime
completedAt   DateTime?
```

---

### WorkflowExecutionStep `[FE — not yet in DB]`
```
id           String   UUID (PK)
tenantId     String   (FK → Tenant) REQUIRED
executionId  String   (FK → WorkflowExecutionRun)
stepIndex    Int
actionType   String   e.g. 'create_task', 'send_email', 'assign_owner'
status       success | failed | skipped
output       JSON?    what was created (taskId, emailId, etc.)
error        String?
executedAt   DateTime
```

---

### Activity `[FE — not yet in DB]`
The unified event timeline for all business objects.
```
id            String   UUID (PK)
tenantId      String   (FK → Tenant) REQUIRED
type          call | meeting | email | sms | whatsapp | note | task |
              workflow | stage-change | file-upload | deal-created | contact-created
relatedToType contact | company | deal | task | invoice
relatedToId   String   (FK → the related entity)
title         String
description   String?
createdBy     String   (FK → User) or 'system' for automations
metadata      JSON?
createdAt     DateTime
```

---

### ServiceOrder `[FE — not yet in DB]`
```
id                    String   UUID (PK)
tenantId              String   (FK → Tenant) REQUIRED
title                 String
description           String
clientName            String
address               String
status                pending | in-progress | completed
assignedTechnicianId  String   (FK → User)
scheduledDate         DateTime
photos                JSON?    { before: string[], after: string[] }
signature             String?
notes                 String?
createdAt             DateTime
```

---

### Asset `[FE — not yet in DB]`
```
id              String   UUID (PK)
tenantId        String   (FK → Tenant) REQUIRED
name            String
category        Security | Telecom | IT | Infrastructure
serialNumber    String
client          String
status          Active | Maintenance | Retired | Faulty
installDate     DateTime
warrantyExpiry  DateTime
location        String
```

---

### InventoryItem `[FE — not yet in DB]`
```
id             String   UUID (PK)
tenantId       String   (FK → Tenant) REQUIRED
name           String
sku            String
category       String
quantity       Int
minQuantity    Int
unitPrice      Float
supplier       String
lastRestocked  DateTime
```

---

### RoleDefinition `[FE — not yet in DB]`
```
id            String   UUID (PK)
tenantId      String   (FK → Tenant) REQUIRED
name          String
description   String
isSystemRole  Boolean
userCount     Int      (derived — count of Users with this role)
permissions   String[] e.g. ['contacts.create', 'deals.edit']
updatedAt     DateTime
isArchived    Boolean
```

---

### AuditLog `[DB]`
```
id            String   UUID (PK)
tenantId      String   (FK → Tenant) REQUIRED
userId        String   (FK → User)
userEmail     String   [FE]
action        String   e.g. 'contact.created', 'deal.stage_changed'
entityType    String   e.g. 'Contact', 'Deal'
entityId      String?
details       String   [FE]
metadata      JSON?    [DB]
changeset     JSON?    [FE]  { field: { old, new } }
ipAddress     String?  [FE]
operatorRole  String?  [FE]
rowId         String?  [FE]  (matches entityId — explicit)
timestamp     DateTime [FE]
createdAt     DateTime [DB]
```

---

## Relationship Summary

| Relationship | Cardinality | FK Field |
|---|---|---|
| Tenant → User | 1:N | `User.tenantId` |
| Tenant → Organization | 1:N | `Organization.tenantId` |
| Tenant → Contact | 1:N | `Contact.tenantId` |
| Organization → Contact | 1:N | `Contact.organizationId` |
| Tenant → Pipeline | 1:N | `Pipeline.tenantId` |
| Pipeline → Stage | 1:N | `Stage.pipelineId` |
| Pipeline → Deal | 1:N | `Deal.pipelineId` |
| Stage → Deal | 1:N | `Deal.stageId` |
| Contact → Deal | 1:N | `Deal.contactIds[]` (array) |
| Deal → Task | 1:N | `Task.dealId` |
| Deal → Invoice | 1:N | `Invoice.dealId` |
| Tenant → Campaign | 1:N | `Campaign.tenantId` |
| Tenant → Template | 1:N | `Template.tenantId` |
| Tenant → Workflow | 1:N | `Workflow.tenantId` |
| Workflow → WorkflowTriggerRecord | 1:N | `WorkflowTriggerRecord.workflowId` |
| WorkflowTriggerRecord → WorkflowExecutionRun | 1:N | `WorkflowExecutionRun.triggerId` |
| WorkflowExecutionRun → WorkflowExecutionStep | 1:N | `WorkflowExecutionStep.executionId` |
| Tenant → Activity | 1:N | `Activity.tenantId` |
| Tenant → ServiceOrder | 1:N | `ServiceOrder.tenantId` |
| Tenant → Asset | 1:N | `Asset.tenantId` |
| Tenant → InventoryItem | 1:N | `InventoryItem.tenantId` |
| Tenant → RoleDefinition | 1:N | `RoleDefinition.tenantId` |
| Tenant → AuditLog | 1:N | `AuditLog.tenantId` |
| User → AuditLog | 1:N | `AuditLog.userId` |

---

## Tenant Isolation Rule

Every table has `tenantId` as a **required, indexed** field. The repository layer enforces it on every query:

```typescript
// Every query is tenant-scoped — no exceptions
prisma.contact.findMany({ where: { tenantId: req.user.tenantId } })

// tenantId source: JWT only — never from request body
const contact = await repo.create(dto, req.user.tenantId);
```

---

## ID Convention

All entity IDs use **UUID v4** (`crypto.randomUUID()`) in the frontend localStorage phase.
The Prisma schema currently uses `cuid()` as the default — both are globally unique.

**Frontend utility (single source):**
```typescript
import { uuid } from '@/lib/utils';
// uuid() = crypto.randomUUID() — no external package
```

**Migration target:** All IDs will be UUID v4 (`gen_random_uuid()` in PostgreSQL) once the real API is wired.

---

## Prisma Schema Migration Backlog

These frontend entities do not yet have Prisma models. They need to be added before `USE_MOCK_DATA=false`:

| Entity | Priority | Blocked By |
|---|---|---|
| `Organization` | High | Contact.organizationId FK dependency |
| `Task` | High | Core CRM operation |
| `Activity` | High | Required for unified timeline |
| `WorkflowTriggerRecord` | High | 3-level execution visibility |
| `WorkflowExecutionRun` | High | 3-level execution visibility |
| `WorkflowExecutionStep` | High | 3-level execution visibility |
| `Invoice` | Medium | Billing integration |
| `Template` | Medium | Campaign email/SMS templates |
| `ServiceOrder` | Medium | Operations module |
| `Asset` | Low | Asset tracking module |
| `InventoryItem` | Low | Inventory module |
| `RoleDefinition` | Medium | RBAC permission system |

---

## See Also
- `backend/prisma/schema.prisma` — Prisma DB schema (current DB state)
- `frontend/src/store/types/` — Frontend type definitions (full target state)
- [permission-matrix.md](../security/permission-matrix.md)
- [audit-log-strategy.md](../security/audit-log-strategy.md)
- [customer-lifecycle.md](../workflows/customer-lifecycle.md)
