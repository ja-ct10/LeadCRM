# Workflow: Task Assignment & Ownership

> Last updated: June 27, 2026

## Overview

Tasks in LeadCRM are linked to deals, contacts, or organizations and always have an owner (`assignedUserId`). Every assignment and reassignment is stored in the `Task` model fields (`assignedById`, `completedById`) and in `AuditLog` for full traceability.

Tasks can also be created automatically via `DealAction (CREATE_TASK)` or by the Workflow Engine.

---

## Task Status Values

```
pending → in_progress → completed
             │
             ├── blocked    (waiting on external factor)
             └── cancelled  (no longer needed)
```

| Status | Meaning |
|---|---|
| `pending` | Created, not yet started |
| `in_progress` | Actively being worked on |
| `blocked` | Cannot proceed — dependency or external blocker |
| `completed` | Done — `completedAt` stamped, `completedById` recorded |
| `cancelled` | Abandoned |

**Overdue:** `dueDate < now()` AND `status NOT IN (completed, cancelled)` → red "Overdue" badge.

---

## Task Model Fields

```
id             cuid PK
tenantId       FK → Tenant    REQUIRED
dealId         FK → Deal?     (set null on delete)
contactId      FK → Contact?  (set null on delete)
organizationId String?
assignedUserId FK → User      current owner
assignedById   FK → User?     who made the last assignment
completedById  FK → User?     who marked it complete
title          String
description    String?
status         pending | in_progress | blocked | completed | cancelled
priority       Low | Medium | High
dueDate        DateTime
reminderAt     DateTime?
completedAt    DateTime?
isArchived     Boolean
```

---

## Assignment Rules

| Role | Can Do |
|---|---|
| Client Admin | Create, assign, reassign, delete any task |
| Sales Rep | Create tasks on own deals; reassign with `assignedById` recorded |
| Technician | View assigned tasks; update `status` |
| Viewer | Read only |

---

## Step-by-Step: Creating a Task

### From Deal Details Modal
1. Open deal → **Tasks tab** → **Add Task**
2. Fill: title, description, due date, priority, assign to (user dropdown)
3. Click **Create Task**

```typescript
// Service layer
await taskService.create({
  tenantId:      req.user.tenantId,
  dealId:        deal.id,
  title:         dto.title,
  assignedUserId: dto.assignedUserId,
  assignedById:  req.user.id,   // captured automatically
  status:        'pending',
  dueDate:       dto.dueDate,
});
// addAuditLog({ action: 'task.created', category: 'crm' })
// addActivity({ type: 'task', dealId: deal.id })
```

### Via DealAction
```typescript
// DealAction (CREATE_TASK) triggers task creation:
await dealActionService.perform({
  actionType:   'CREATE_TASK',
  dealId:       deal.id,
  performedById: req.user.id,
  payload: { title: 'Prepare proposal document', dueDate: '...' }
});
// → Creates Task + DealAction row + Activity entry
```

### Via Workflow Engine
When a workflow action `create_task` fires:
- `WorkflowExecutionStep.actionType = create_task`
- Task created with `assignedById = null` (system-created)
- `Activity ({ type: 'workflow', dealId })` created

---

## Step-by-Step: Reassigning a Task

1. Open task → change assignee dropdown
2. Optionally enter reassignment reason

```typescript
await taskService.update(taskId, {
  assignedUserId: newUserId,
  assignedById:   currentUser.id,
});
// addAuditLog({ action: 'task.reassigned', category: 'crm', changeset: { before: { assignedUserId: old }, after: { assignedUserId: new } } })
```

---

## Step-by-Step: Completing a Task

```typescript
await taskService.update(taskId, {
  status:        'completed',
  completedById: currentUser.id,
  completedAt:   new Date(),
});
// addAuditLog({ action: 'task.completed', category: 'crm' })
// addActivity({ type: 'task', dealId, title: 'Task completed: ...' })
```

---

## Audit Trail

| Question | Where to Find It |
|---|---|
| Who owns the task now? | `Task.assignedUserId` |
| Who assigned it? | `Task.assignedById` |
| When was it completed? | `Task.completedAt` |
| Who completed it? | `Task.completedById` |
| Full history of changes? | `AuditLog` (action: `task.*`, category: `crm`) |
| Deal timeline entry? | `Activity` (type: `task`, dealId) |

---

## Overdue Detection Logic

```typescript
function isOverdue(task: Task): boolean {
  if (['completed', 'cancelled'].includes(task.status)) return false;
  return new Date(task.dueDate) < new Date();
}
```

Displayed in:
- Deal Details Modal → Tasks tab
- TaskBoard (Operations → Tasks)

---

## Related Docs
- `docs/workflows/pipeline-stage-flow.md`
- `docs/workflows/lead-to-deal.md`
- `docs/database/erd.md` — Task entity definition
