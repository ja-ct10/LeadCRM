---
name: prisma-patterns
description: Prisma 5 ORM patterns for LeadCRM — multi-tenant scoping, query optimization, transactions, pagination, soft deletes, and critical traps. Apply when writing or reviewing any Prisma schema, migration, or repository query.
---

# Prisma Patterns — LeadCRM

## Multi-Tenant Rule (Non-Negotiable)

```typescript
// WRONG — cross-tenant exposure
const contacts = await prisma.contact.findMany();

// CORRECT — always tenant-scoped + soft-delete filter
const contacts = await prisma.contact.findMany({
  where: { tenantId, deletedAt: null },
  orderBy: { createdAt: 'desc' },
});

// Single record — always 404, never 403 on cross-tenant
const contact = await prisma.contact.findFirst({ where: { id, tenantId } });
if (!contact) throw new AppError('Contact not found', 404);
```

## include vs select

```typescript
// include — all scalar columns + specified relations
const deal = await prisma.deal.findUnique({
  where: { id },
  include: {
    stage: true,
    assignedUser: { select: { id: true, firstName: true, lastName: true } },
    contactDeals: { include: { contact: { select: { id: true, firstName: true } } } },
  },
});

// Never return raw Prisma entities from API — map to DTOs
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
return { id: user.id, firstName: user.firstName, email: user.email, role: user.role };
```

## Transactions

```typescript
// Array form — independent ops in one round trip
const [contact, activity] = await prisma.$transaction([
  prisma.contact.update({ where: { id, tenantId }, data: { status } }),
  prisma.activity.create({ data: { tenantId, type: 'status_change', contactId: id } }),
]);

// Interactive form — when steps depend on earlier results
const result = await prisma.$transaction(async (tx) => {
  const deal = await tx.deal.findUniqueOrThrow({ where: { id, tenantId } });
  if (deal.stageId === newStageId) return deal; // no-op guard
  await tx.dealStageHistory.create({ data: { tenantId, dealId: id, previousStageId: deal.stageId, newStageId, movedById } });
  return tx.deal.update({ where: { id }, data: { stageId: newStageId } });
});
// Never call outer `prisma` inside an interactive tx — use `tx` only
```

## Pagination (Required on All List Endpoints)

```typescript
const page = Math.max(1, Number(req.query.page) || 1);
const limit = Math.min(100, Number(req.query.limit) || 20);
const offset = (page - 1) * limit;

const [data, total] = await Promise.all([
  prisma.contact.findMany({ where: { tenantId, deletedAt: null }, skip: offset, take: limit }),
  prisma.contact.count({ where: { tenantId, deletedAt: null } }),
]);

return { data, meta: { total, page, limit, hasMore: offset + data.length < total } };
```

## Soft Delete Pattern

```typescript
// Soft delete — never hard delete CRM records
await prisma.contact.update({
  where: { id, tenantId },
  data: { deletedAt: new Date(), deletedBy: currentUserId },
});

// All active queries include: deletedAt: null
```

## Critical Traps

| Trap | Problem | Fix |
|---|---|---|
| `updateMany` returns `{ count: N }` | Not records — can't iterate | Use `findMany` then update, or `$transaction` |
| `@updatedAt` on `updateMany` | Does NOT auto-set | Add `updatedAt: new Date()` explicitly |
| `migrate dev` in production | Resets DB | Use `migrate deploy` in prod only |
| `$transaction` timeout | Default 5s | Pass `{ timeout: 15000 }` for complex ops |
| Missing `tenantId` on query | Cross-tenant leak | All queries must include `where: { tenantId }` |

## Index Strategy

```prisma
// Always index tenantId + common filter combos
@@index([tenantId, status])
@@index([tenantId, createdAt])
@@index([tenantId, assignedUserId])
```

## Prisma Checklist

- [ ] Every query filtered by `tenantId`
- [ ] No raw Prisma entities from API — DTOs only
- [ ] `updateMany` results not iterated (returns count)
- [ ] `updatedAt` set manually on `updateMany`
- [ ] `migrate deploy` in prod — `migrate dev` local only
- [ ] `deletedAt: null` on all active record queries
- [ ] Pagination on all list queries (default 20, max 100)
