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
      role: [actorId, 'new-actor'].includes(where.id) ? "Client Admin" : "Sales",
      tenant: { status: "ACTIVE" }, userRoles: [{ role: { permissions: [{ module: 'tasks', canView: true }] } }],
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
    const task = await scoped(() => service.updateTask(original.id, tenantId, 'new-actor', { assignedUserId: 'replacement', status: 'completed' }));
    expect(task).toMatchObject({ createdById: actorId, assignedUserId: 'replacement', assignedById: 'new-actor' });
    expect(db.task.update.mock.calls[0][0].data).not.toHaveProperty('createdById');
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
