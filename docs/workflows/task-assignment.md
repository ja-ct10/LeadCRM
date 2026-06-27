# Workflow: Task Assignment & Ownership

## Overview

Tasks in LeadCRM are always linked to a deal (`task.dealId`) and always have an owner (`task.assignedUserId`). Every assignment and reassignment is tracked in `task.assignmentHistory[]` for full auditability.

---

## Task Status Values

```
Pending → In Progress → Completed
                │
                ├── Blocked  (waiting on dependency or external factor)
                └── Cancelled (task no longer needed)
```

| Status | Meaning |
|---|---|
| `pending` | Created, not yet started |
| `in-progress` | Actively being worked on |
| `blocked` | Cannot proceed — dependency or external blocker |
| `completed` | Done |
| `cancelled` | Abandoned — no longer required |

**Overdue:** Any task where `dueDate < today` and `status !== completed` and `status !== cancelled` is highlighted with a red "Overdue" badge.

---

## Assignment Rules

| Role | Can Do |
|---|---|
| Client Admin | Create, assign, reassign, delete any task |
| Sales Rep | Create tasks on own deals; reassign with reason |
| Viewer | Read only |
| Technician | View assigned tasks; update status |

---

## Step-by-Step: Creating and Assigning a Task

### From Deal Details Modal
1. Open any deal in Pipeline Management → click the deal card
2. In the modal, click the **Tasks** tab
3. Click **Add Task**
4. Fill in: title, description (optional), due date, priority, assign to (user dropdown)
5. Click **Create Task**

**What happens internally:**
```typescript
addTask({
  dealId: deal.id,
  title: '...',
  assignedUserId: selectedUserId,
  assignedBy: currentUser.id,   // auto-captured
  status: 'pending',
  // ...
})
```
`assignmentHistory` is seeded with the first record automatically.

### From TaskBoard (Operations → Tasks)
1. Navigate to Operations → Task Board
2. Click **+ New Task**
3. Fill in form including assignee

---

## Step-by-Step: Reassigning a Task

1. Open deal → Tasks tab → find the task
2. Change status or reassignee from the inline dropdown
3. Optionally provide a reassignment reason

**What happens internally:**
```typescript
updateTask(taskId, {
  assignedUserId: newUserId,
  reassignReason: 'Territory Transfer',
})
```
A new `TaskAssignmentRecord` is appended to `assignmentHistory`:
```typescript
{
  assignedTo:       newUserId,
  assignedBy:       currentUser.id,
  assignedAt:       '2026-06-24T10:00:00Z',
  previousAssignee: oldUserId,
  reason:           'Territory Transfer',
}
```

---

## Audit Trail

Every task maintains a complete assignment history. Managers can always answer:

| Question | Where to Find It |
|---|---|
| Who owns the task now? | `task.assignedUserId` |
| Who assigned it? | `task.assignedBy` |
| Who owned it before? | `task.assignmentHistory[last].previousAssignee` |
| When was it reassigned? | `task.assignmentHistory[last].assignedAt` |
| Why was it reassigned? | `task.assignmentHistory[last].reason` |
| When was it completed? | `task.updatedAt` (when status → completed) |

---

## Overdue Detection Logic

```typescript
function isOverdue(task: Task): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  if (!task.dueDate) return false;
  return new Date(task.dueDate) < new Date();
}
```

Shown as a red **Overdue** badge in:
- Deal Details Modal → Tasks tab
- TaskBoard (Operations)

---

## Related Docs
- [pipeline-stage-flow.md](./pipeline-stage-flow.md)
- [lead-to-deal.md](./lead-to-deal.md)
