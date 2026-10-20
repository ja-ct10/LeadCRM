import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantContext } from "../../../../core/tenant/tenant-context";

const db = vi.hoisted(() => {
  const model = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  });
  return {
    task: model(),
    user: model(),
    lead: model(),
    contact: model(),
    deal: model(),
    account: model(),
    taskDeal: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
});
vi.mock("../../../../config/database.config", () => ({ default: db }));
vi.mock('../tasks.history', async importOriginal => ({ ...(await importOriginal<any>()), recordTaskHistory: vi.fn() }));
import { recordTaskHistory } from '../tasks.history';
import * as service from "../tasks.service";

const tenantId = "task-tenant";
const actorId = "task-actor";
const input = {
  title: "Call customer",
  assignedUserId: "task-owner",
  dueDate: "2026-10-01T09:00:00.000Z",
  status: "pending" as const,
  priority: "High" as const,
  dealIds: ["deal"],
};
const original = {
  leadLinks: [], contactLinks: [], dealLinks: [], accountLinks: [],
  ...input,
  id: "task-id",
  tenantId,
  dueDate: new Date(input.dueDate),
  description: null,
  reminderAt: null,
  leadId: null,
  contactId: null,
  dealId: null,
  accountId: null,
  assignedById: actorId,
  createdById: actorId,
  completedAt: null,
  completedById: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const scoped = <T>(work: () => T) =>
  tenantContext.run({ tenantId, }, work);

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) =>
    work(db),
  );
  db.user.findFirst.mockImplementation(({ where }) =>
    Promise.resolve({
      id: where.id,
      tenantId,
      status: "ACTIVE",
      role: [actorId, 'new-actor'].includes(where.id) ? "Client Admin" : "Task staff",
      tenant: { status: "ACTIVE" }, userRoles: [{ tenantId, role: { tenantId, isArchived: false,
        name: 'Task staff',
        permissions: [{ tenantId, module: 'tasks', canView: true }] } }],
    }),
  );
  db.task.findFirst.mockResolvedValue({ ...original });
  db.task.create.mockImplementation(({ data }) =>
    Promise.resolve({ ...original, ...data }),
  );
  db.task.update.mockImplementation(({ data }) =>
    Promise.resolve({ ...original, ...data }),
  );
  db.task.updateMany.mockResolvedValue({ count: 1 });
  for (const model of [db.lead, db.contact, db.account]) model.findMany.mockResolvedValue([]);
  db.deal.findMany.mockImplementation(({ where }) => Promise.resolve(where.id.in.filter((id: string) => id === "deal").map((id: string) => ({ id, assignedUserId: actorId }))));
});

describe("Task service authority", () => {
  it('defaults manual creation to To do and the authenticated assignee', async () => {
    db.user.findFirst.mockImplementation(({ where }) => Promise.resolve({ id: where.id, tenantId, role: 'Sales Agent', status: 'ACTIVE', tenant: { status: 'ACTIVE' },
      userRoles: [{ tenantId, role: { tenantId, name: 'Sales Agent', isArchived: false, permissions: [{ tenantId, module: 'tasks', canView: true, canCreate: true }, { tenantId, module: 'deals', canView: true, canViewAll: true }] } }] }));
    const { status: _status, assignedUserId: _assignee, ...draft } = input;
    await scoped(() => service.createTask(tenantId, actorId, draft));
    expect(db.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'pending', assignedUserId: actorId }) }));
  });
  it.each(['in_progress', 'blocked', 'overdue', 'completed', 'cancelled'])('rejects manual creation status %s before any database write', async status => {
    await expect(scoped(() => service.createTask(tenantId, actorId, { ...input, status }))).rejects.toMatchObject({ statusCode: 400 });
    expect(db.task.create).not.toHaveBeenCalled();
    expect(recordTaskHistory).not.toHaveBeenCalled();
  });
  it('reads legacy Blocked as To do or Overdue without rewriting the saved record', () => {
    const blocked = { ...original, status: 'blocked', dueDate: new Date('2099-01-01') };
    expect(service.serializeTask(blocked as any)).toMatchObject({ status: 'pending', displayStatus: 'pending' });
    expect(service.serializeTask({ ...blocked, dueDate: new Date('2020-01-01') } as any)).toMatchObject({ status: 'pending', displayStatus: 'overdue' });
    expect(blocked.status).toBe('blocked');
  });
  it.each(['Sales Agent', 'Sales Representative'])('rejects a %s creator after assignment moves to another user, including direct service calls', async role => {
    db.user.findFirst.mockImplementation(({ where }) => Promise.resolve({ id: where.id, tenantId, role, status: 'ACTIVE', tenant: { status: 'ACTIVE' },
      userRoles: [{ tenantId, role: { name: role, tenantId, isArchived: false, permissions: [{ tenantId, module: 'tasks', canView: true, canEdit: true, canComplete: true, canArchive: true }] } }] }));
    for (const mutate of [() => service.updateTask(original.id, tenantId, actorId, { title: 'Hidden' }),
      () => service.completeTask(original.id, tenantId, actorId), () => service.archiveTask(original.id, tenantId, actorId)]) {
      await expect(scoped(mutate)).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(db.task.update).not.toHaveBeenCalled();
    expect(recordTaskHistory).not.toHaveBeenCalled();
  });

  it('rejects a stale edit before Task, association, or history writes', async () => {
    await expect(scoped(() => service.updateTask(original.id, tenantId, actorId, {
      title: 'Stale title', expectedUpdatedAt: new Date(original.updatedAt.getTime() - 1).toISOString(),
    }))).rejects.toMatchObject({ statusCode: 409 });
    expect(db.task.update).not.toHaveBeenCalled();
    expect(db.taskDeal.deleteMany).not.toHaveBeenCalled();
    expect(recordTaskHistory).not.toHaveBeenCalled();
  });

  it('accepts the saved version without persisting precondition metadata', async () => {
    await scoped(() => service.updateTask(original.id, tenantId, actorId, {
      title: 'Current edit', expectedUpdatedAt: original.updatedAt.toISOString(),
    }));
    expect(db.task.update).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Current edit' } }));
  });

  it('keeps completion-only permission independent when a precondition is supplied', async () => {
    db.user.findFirst.mockImplementation(({ where }) => Promise.resolve({ id: where.id, tenantId, status: 'ACTIVE', role: 'Task completer',
      tenant: { status: 'ACTIVE' }, userRoles: [{ tenantId, role: { tenantId, name: 'Task completer', isArchived: false,
        permissions: [{ tenantId, module: 'tasks', canView: true, canComplete: true }] } }] }));
    await expect(scoped(() => service.updateTask(original.id, tenantId, actorId, {
      status: 'completed', expectedUpdatedAt: original.updatedAt.toISOString(),
    }))).resolves.toMatchObject({ status: 'completed', completedById: actorId });
    await expect(scoped(() => service.updateTask(original.id, tenantId, actorId, {
      title: 'Not permitted', expectedUpdatedAt: original.updatedAt.toISOString(),
    }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows a Client Admin actor to assign staff but rejects Client Admin as the assignee', async () => {
    await expect(scoped(() => service.createTask(tenantId, actorId, { ...input, assignedUserId: actorId }))).rejects.toMatchObject({ statusCode: 404 });
    expect(db.task.create).not.toHaveBeenCalled();
    await expect(scoped(() => service.createTask(tenantId, actorId, input))).resolves.toMatchObject({ createdById: actorId, assignedUserId: input.assignedUserId });
  });

  it('preserves an unchanged historical assignee during ordinary edits', async () => {
    db.task.findFirst.mockResolvedValue({ ...original, assignedUserId: actorId });
    await expect(scoped(() => service.updateTask(original.id, tenantId, actorId, { assignedUserId: actorId, title: 'Retain historical assignment' }))).resolves.toMatchObject({ title: 'Retain historical assignment' });
  });
  it("sets the immutable creator from the validated actor separately from the assigned agent", async () => {
    const task = await scoped(() => service.createTask(tenantId, actorId, input));
    expect(task).toMatchObject({ createdById: actorId, assignedUserId: input.assignedUserId, assignedById: actorId });
    expect(db.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: actorId }) }));
  });

  it("rejects spoofed creator input on creation and reassignment", async () => {
    await expect(scoped(() => service.createTask(tenantId, actorId, { ...input, createdById: 'spoof' }))).rejects.toThrow();
    await expect(scoped(() => service.updateTask(original.id, tenantId, actorId, { assignedUserId: 'replacement', createdById: 'spoof' }))).rejects.toThrow();
    expect(db.task.create).not.toHaveBeenCalled();
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("reassignment and completion leave the original creator intact", async () => {
    const task = await scoped(() => service.updateTask(original.id, tenantId, actorId, { assignedUserId: 'replacement', status: 'completed' }));
    expect(task).toMatchObject({ createdById: actorId, assignedUserId: 'replacement', assignedById: actorId });
    expect(db.task.update.mock.calls[0][0].data).not.toHaveProperty('createdById');
  });
  it.each(['new-actor', input.assignedUserId])('rejects non-owner %s including administrators and assignees before any writes', async userId => {
    for (const mutate of [
      () => service.updateTask(original.id, tenantId, userId, { title: 'Denied', dealIds: ['deal'] }),
      () => service.completeTask(original.id, tenantId, userId),
      () => service.archiveTask(original.id, tenantId, userId),
    ]) await expect(scoped(mutate)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.task.update).not.toHaveBeenCalled();
    expect(db.taskDeal.deleteMany).not.toHaveBeenCalled();
    expect(db.taskDeal.createMany).not.toHaveBeenCalled();
    expect(recordTaskHistory).not.toHaveBeenCalled();
  });
  it('does not infer ownership for records with no creator', async () => {
    db.task.findFirst.mockResolvedValue({ ...original, createdById: null });
    await expect(scoped(() => service.updateTask(original.id, tenantId, actorId, { title: 'Denied' }))).rejects.toMatchObject({ statusCode: 403, message: 'Only the task owner can edit this task.' });
    await expect(scoped(() => service.archiveTask(original.id, tenantId, actorId))).rejects.toMatchObject({ statusCode: 403, message: 'Only the task owner can archive this task.' });
    expect(db.task.update).not.toHaveBeenCalled();
    expect(recordTaskHistory).not.toHaveBeenCalled();
  });
  it('retains per-record failures for mixed-owner bulk mutations', async () => {
    db.task.findFirst.mockImplementation(({ where }) => Promise.resolve({ ...original, id: where.id, createdById: where.id === 'owned' ? actorId : 'another-owner' }));
    const result = await scoped(() => service.bulkTasks(tenantId, actorId, { operation: 'complete', ids: ['owned', 'not-owned'] }));
    expect(result).toEqual({ succeeded: ['owned'], failed: [{ id: 'not-owned', error: 'Only the task owner can edit this task.' }] });
    expect(db.task.update).toHaveBeenCalledOnce();
  });
  it("validates payloads even when called directly by Workflow", async () => {
    await expect(
      scoped(() =>
        service.createTask(tenantId, actorId, { ...input, title: "   " }),
      ),
    ).rejects.toThrow();
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("requires a matching tenant context before writing", async () => {
    await expect(
      service.createTask(tenantId, actorId, input),
    ).rejects.toThrow();
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("rejects a missing, foreign-tenant, or inactive assignee before persistence", async () => {
    db.user.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(where.id === actorId ? { id: actorId } : null),
    );
    await expect(
      scoped(() => service.createTask(tenantId, actorId, input)),
    ).rejects.toThrow();
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it.each(["leadId", "contactId", "dealId"] as const)(
    "rejects inaccessible %s without creating a task or audit",
    async (field) => {
      await expect(
        scoped(() =>
          service.createTask(tenantId, actorId, {
            ...input,
            [field]: "inaccessible-record",
          }),
        ),
      ).rejects.toThrow();
      expect(db.task.create).not.toHaveBeenCalled();
      expect(recordTaskHistory).not.toHaveBeenCalled();
    },
  );

  it("records completion actor and time through generic status update", async () => {
    const task = await scoped(() =>
      service.updateTask(original.id, tenantId, actorId, {
        status: "completed",
      }),
    );
    expect(task).toMatchObject({
      status: "completed",
      completedById: actorId,
      completedAt: expect.any(Date),
    });
    expect(recordTaskHistory).toHaveBeenCalledWith(db, actorId, expect.objectContaining({ completedById: actorId }), expect.any(Object), {});
  });

  it("clears completion metadata when a completed task is reopened", async () => {
    db.task.findFirst.mockResolvedValue({
      ...original,
      status: "completed",
      completedAt: new Date(),
      completedById: "previous-actor",
    });
    await scoped(() =>
      service.updateTask(original.id, tenantId, actorId, { status: "pending" }),
    );
    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completedAt: null,
          completedById: null,
        }),
      }),
    );
  });

  it("preserves the first completion attribution on repeated completion", async () => {
    const completed = {
      ...original,
      status: "completed",
      completedAt: new Date("2026-09-20T00:00:00Z"),
      completedById: "original-actor",
    };
    db.task.findFirst.mockResolvedValue(completed);
    const task = await scoped(() =>
      service.completeTask(original.id, tenantId, actorId),
    );
    expect(task.completedById).toBe("original-actor");
    expect(task.completedAt).toEqual(completed.completedAt);
  });

  it("records the actual assigning actor and prior owner on reassignment", async () => {
    await scoped(() =>
      service.updateTask(original.id, tenantId, actorId, {
        assignedUserId: "new-owner",
      }),
    );
    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedById: actorId }),
      }),
    );
    expect(recordTaskHistory).toHaveBeenCalledWith(db, actorId, expect.objectContaining({ assignedUserId: 'new-owner' }), expect.objectContaining({ assignedUserId: input.assignedUserId }), {});
  });

  it("rejects edits of archived tasks", async () => {
    db.task.findFirst.mockResolvedValue({ ...original, isArchived: true });
    await expect(
      scoped(() =>
        service.updateTask(original.id, tenantId, actorId, {
          title: "Changed",
        }),
      ),
    ).rejects.toThrow();
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("propagates database failures rather than reporting not-found", async () => {
    const outage = new Error("Database unavailable");
    db.task.update.mockRejectedValue(outage);
    await expect(
      scoped(() =>
        service.updateTask(original.id, tenantId, actorId, {
          title: "Changed",
        }),
      ),
    ).rejects.toBe(outage);
    expect(recordTaskHistory).not.toHaveBeenCalled();
  });

  it("rejects permanent deletion without touching storage", async () => {
    await expect(scoped(() => service.bulkTasks(tenantId, actorId, { operation: "delete", ids: [original.id] }))).rejects.toThrow();
    expect(db.task.deleteMany).not.toHaveBeenCalled();
  });

  it.each([[], [""], Array(101).fill("id")])(
    "rejects invalid deletion IDs before accessing storage",
    async (ids) => {
      await expect(
        scoped(() =>
          service.bulkTasks(tenantId, actorId, { operation: "delete", ids }),
        ),
      ).rejects.toThrow();
      expect(db.task.deleteMany).not.toHaveBeenCalled();
    },
  );
});
