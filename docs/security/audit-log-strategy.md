# Audit Log Strategy — LeadCRM

## Principle

Every data-mutating operation in LeadCRM generates an `AuditLog` entry. No exception. This provides:
- Full traceability for compliance and accountability
- "Who did what, when, to which record" for every change
- Changeset records showing old → new values for critical fields

---

## What Gets Logged

### Auth Events
| Action | Trigger |
|---|---|
| `Auth Login` | User successfully authenticates |
| `Auth Logout` | User logs out |
| `Auth MFA Update` | MFA enabled or disabled |
| `Auth Failed Login` | Failed login attempt |

### Contact Events
| Action | Trigger |
|---|---|
| `Contact Created` | New contact added |
| `Contact Updated` | Any field changed (changeset recorded) |
| `Contact Archived` | Contact soft-deleted |
| `Contact Restored` | Archived contact restored |

### Deal Events
| Action | Trigger |
|---|---|
| `Deal Created` | New deal added to pipeline |
| `Deal Updated` | Any field changed (changeset recorded) |
| `Deal Stage Changed` | `stageId` changes — also writes `deal.history[]` entry |
| `Deal Archived` | Deal soft-deleted |
| `Deal Restored` | Archived deal restored |

### Task Events
| Action | Trigger |
|---|---|
| `Task Created` | New task created (+ first `assignmentHistory` record) |
| `Task Updated` | Status, title, or other fields changed |
| `Task Reassigned` | `assignedUserId` changes (+ new `assignmentHistory` record) |

### User & Role Events
| Action | Trigger |
|---|---|
| `User Created` | New user added to tenant |
| `User Updated` | Role, status, or profile changed |
| `Role Updated` | Role permissions changed |

### Workflow Events
| Action | Trigger |
|---|---|
| `Workflow Automation` | Workflow executed for a contact or deal |
| `Workflow Created` | New automation workflow saved |
| `Workflow Updated` | Trigger, conditions, or actions changed |

### Pipeline Events
| Action | Trigger |
|---|---|
| `Pipeline Archived` | Pipeline soft-deleted |

### Billing Events
| Action | Trigger |
|---|---|
| `Invoice Created` | New invoice generated |
| `Payment Received` | PayMongo webhook confirms payment |

---

## Log Entry Shape

```typescript
interface AuditLog {
  id:          string;   // cuid
  tenantId:    string;   // tenant scope — REQUIRED
  userId:      string;   // who performed the action
  userEmail:   string;   // denormalized for display
  action:      string;   // human-readable action name
  entityType?: string;   // 'Deal' | 'Contact' | 'Task' | ...
  entityId?:   string;   // ID of the affected record
  details:     string;   // plain-English description
  changeset?:  Record<string, { old: unknown; new: unknown }>;
  ipAddress?:  string;   // request IP (backend only)
  timestamp:   string;   // ISO 8601
}
```

---

## Changeset Format

For updates, include the fields that changed:

```json
{
  "action": "Deal Updated",
  "changeset": {
    "stageId": {
      "old": "stage_proposal",
      "new": "stage_negotiation"
    },
    "value": {
      "old": 85000,
      "new": 90000
    }
  }
}
```

Changeset is stored as `metadata` (JSON) in the Prisma `AuditLog` model.

---

## Implementation Pattern

### Frontend (DataContext)
```typescript
// Every mutation calls addAuditLog:
const updateDeal = (id: string, updates: Partial<Deal>) => {
  // ... apply update ...
  addAuditLog(
    'Deal Updated',
    `Updated pipeline stage to '${newStageName}' for deal '${deal.title}'.`,
    id,
    changeset
  );
};
```

### Backend (Service layer)
```typescript
// audit.service.ts records to DB:
await auditService.log({
  tenantId:   req.user.tenantId,
  userId:     req.user.id,
  action:     'Contact Created',
  entityType: 'Contact',
  entityId:   contact.id,
  details:    `Created contact ${contact.firstName} ${contact.lastName}`,
  metadata:   { source: contact.source },
  ipAddress:  req.ip,
});
```

---

## Audit Log Viewer

Location: Client Profile → Audit tab

Displays:
- Operator (user who performed the action)
- Action name
- Description
- Changeset (expandable)
- Timestamp
- IP Address

Visible to: **Client Admin** only (`audit.view` permission required)

Font recommendation for changeset display: **JetBrains Mono** for monospace readability.

---

## Retention Policy

| Environment | Retention |
|---|---|
| Sandbox | 30 days |
| Production (Free) | 90 days |
| Production (Pro) | 1 year |
| Production (Enterprise) | Unlimited |

---

## What Does NOT Get Logged

- Read operations (view, search, export preview)
- Failed permission checks (these go to security logs, not audit logs)
- System health checks

---

## See Also
- `frontend/src/store/DataContext.tsx` — `addAuditLog()` implementation
- `backend/src/core/audit/audit.service.ts` — backend service
- [permission-matrix.md](./permission-matrix.md)
