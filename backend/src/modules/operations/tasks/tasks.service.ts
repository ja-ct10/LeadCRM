import type { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskQuerySchema,
  TaskBulkSchema,
  TaskOptionsQuerySchema,
  TaskStatusSchema,
  type TaskRecord,
  type TaskSummary,
  type TaskBulkResult,
} from "@leadcrm/shared";
import * as repo from "./tasks.repository";
import { writeAuditLog } from "../../../core/audit/audit.service";
import { environmentContext } from "../../../core/environment/environment-context";
import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/http-error";
import { AppError } from "../../../shared/errors/app-error";
import { paginate } from "../../../shared/helpers/pagination";

function parseInput<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ValidationError(
      result.error.issues[0]?.message ?? "Invalid task input.",
    );
  return result.data;
}
function requireScope(tenantId: string) {
  if (environmentContext.getStore()?.tenantId !== tenantId)
    throw new ValidationError(
      "A matching CRM environment is required for tasks.",
    );
}
export function serializeTask(task: repo.TaskRow): TaskRecord {
  const person = (value: typeof task.assignedUser | null) =>
    value?.tenantId === task.tenantId
      ? { id: value.id, firstName: value.firstName, lastName: value.lastName }
      : null;
  const linkedPerson = (value: typeof task.lead) =>
    value?.environment === task.environment ? person(value) : null;
  return {
    id: task.id,
    tenantId: task.tenantId,
    environment: task.environment,
    title: task.title,
    description: task.description ?? "",
    status: TaskStatusSchema.parse(task.status),
    priority: task.priority as TaskRecord["priority"],
    dueDate: task.dueDate.toISOString(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    reminderAt: task.reminderAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    completedById: task.completedById,
    assignedUserId: task.assignedUserId,
    assignedById: task.assignedById,
    isArchived: task.isArchived,
    leadId: task.leadId,
    contactId: task.contactId,
    dealId: task.dealId,
    accountId: task.accountId,
    assignedUser: person(task.assignedUser),
    assignedByUser: person(task.assignedBy),
    completedBy: person(task.completedBy),
    lead: linkedPerson(task.lead),
    contact: linkedPerson(task.contact),
    deal:
      task.deal?.tenantId === task.tenantId &&
      task.deal.environment === task.environment
        ? { id: task.deal.id, title: task.deal.title }
        : null,
  };
}
export async function getTasks(
  tenantId: string,
  query: Record<string, unknown>,
) {
  requireScope(tenantId);
  const result = await repo.findAllTasks(
    tenantId,
    parseInput(TaskQuerySchema, query),
  );
  const accounts = await repo.findTaskAccounts(tenantId, [
    ...new Set(
      result.data.flatMap((task) => (task.accountId ? [task.accountId] : [])),
    ),
  ]);
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  return paginate(
    result.data.map((task) => ({
      ...serializeTask(task),
      account: task.accountId ? (accountMap.get(task.accountId) ?? null) : null,
    })),
    result.total,
    result,
  );
}
export async function getTaskById(id: string, tenantId: string) {
  requireScope(tenantId);
  const task = await repo.findTaskById(id, tenantId);
  if (!task) throw new NotFoundError("Task");
  return task;
}
async function validateReferences(
  tenantId: string,
  userId: string,
  data: {
    assignedUserId?: string;
    leadId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
    accountId?: string | null;
  },
  client: repo.TaskClient,
) {
  if (!(await repo.findTaskUser(userId, tenantId, client)))
    throw new NotFoundError("Active workspace actor");
  if (
    data.assignedUserId &&
    !(await repo.findTaskUser(data.assignedUserId, tenantId, client))
  )
    throw new NotFoundError("Active workspace assignee");
  for (const kind of ["lead", "contact", "deal", "account"] as const) {
    const id = data[`${kind}Id`];
    if (id && !(await repo.findTaskLink(kind, id, tenantId, client)))
      throw new NotFoundError("Related record");
  }
}
function auditState(task: repo.TaskRow) {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignedUserId: task.assignedUserId,
    assignedById: task.assignedById,
    completedAt: task.completedAt,
    completedById: task.completedById,
    leadId: task.leadId,
    contactId: task.contactId,
    dealId: task.dealId,
    accountId: task.accountId,
    isArchived: task.isArchived,
  };
}
export async function createTask(
  tenantId: string,
  userId: string,
  input: unknown,
) {
  requireScope(tenantId);
  const dto = parseInput(CreateTaskSchema, input);
  if (dto.reminderAt)
    throw new ValidationError("Task reminder delivery is not available.");
  const task = await repo.withTaskTransaction(async (client) => {
    await validateReferences(tenantId, userId, dto, client);
    return repo.createTask(
      {
        ...dto,
        tenantId,
        assignedById: userId,
        ...(dto.status === "completed"
          ? { completedAt: new Date(), completedById: userId }
          : {}),
      },
      client,
    );
  });
  await writeAuditLog({
    tenantId,
    userId,
    action: "task.created",
    entityType: "Task",
    entityId: task.id,
    after: auditState(task),
  });
  return task;
}
export async function updateTask(
  id: string,
  tenantId: string,
  userId: string,
  input: unknown,
) {
  requireScope(tenantId);
  const { reassignReason, ...dto } = parseInput(UpdateTaskSchema, input);
  const result = await repo.withTaskTransaction(async (client) => {
    const before = await repo.findTaskById(id, tenantId, client);
    if (!before || before.isArchived) throw new NotFoundError("Active task");
    await validateReferences(tenantId, userId, dto, client);
    if (dto.reminderAt && dto.reminderAt !== before.reminderAt?.toISOString())
      throw new ValidationError("Task reminder delivery is not available.");
    const data: Prisma.TaskUncheckedUpdateInput = { ...dto };
    if (dto.assignedUserId && dto.assignedUserId !== before.assignedUserId)
      data.assignedById = userId;
    if (dto.status === "completed" && before.status !== "completed") {
      data.completedAt = new Date();
      data.completedById = userId;
    }
    if (dto.status && dto.status !== "completed") {
      data.completedAt = null;
      data.completedById = null;
    }
    if (
      dto.status === "completed" &&
      before.status === "completed" &&
      Object.keys(dto).length === 1
    )
      return { before, task: before, changed: false };
    const task = await repo.updateTask(id, tenantId, data, client);
    return { before, task, changed: true };
  });
  if (result.changed)
    await writeAuditLog({
      tenantId,
      userId,
      action:
        dto.status === "completed" && result.before.status !== "completed"
          ? "task.completed"
          : "task.updated",
      entityType: "Task",
      entityId: id,
      before: auditState(result.before),
      after: auditState(result.task),
      ...(reassignReason ? { metadata: { reassignReason } } : {}),
    });
  return result.task;
}
export function completeTask(id: string, tenantId: string, userId: string) {
  return updateTask(id, tenantId, userId, { status: "completed" });
}
export async function archiveTask(
  id: string,
  tenantId: string,
  userId: string,
) {
  requireScope(tenantId);
  const { before, task } = await repo.withTaskTransaction(async (client) => {
    const before = await repo.findTaskById(id, tenantId, client);
    if (!before) throw new NotFoundError("Task");
    await validateReferences(tenantId, userId, {}, client);
    return {
      before,
      task: before.isArchived
        ? before
        : await repo.updateTask(id, tenantId, { isArchived: true }, client),
    };
  });
  if (!before.isArchived)
    await writeAuditLog({
      tenantId,
      userId,
      action: "task.archived",
      entityType: "Task",
      entityId: id,
      before: auditState(before),
      after: auditState(task),
    });
  return task;
}
export async function bulkTasks(
  tenantId: string,
  userId: string,
  input: unknown,
): Promise<TaskBulkResult> {
  requireScope(tenantId);
  const dto = parseInput(TaskBulkSchema, input);
  const result: TaskBulkResult = { succeeded: [], failed: [] };
  for (const id of dto.ids) {
    try {
      if (dto.operation === "archive") await archiveTask(id, tenantId, userId);
      else
        await updateTask(
          id,
          tenantId,
          userId,
          dto.operation === "assign"
            ? { assignedUserId: dto.assignedUserId }
            : dto.operation === "reschedule"
              ? { dueDate: dto.dueDate }
              : { status: "completed" },
        );
      result.succeeded.push(id);
    } catch (error) {
      result.failed.push({
        id,
        error:
          error instanceof AppError
            ? error.message
            : "Could not save this task. Refresh and retry.",
      });
    }
  }
  return result;
}
export async function getTaskSummary(
  tenantId: string,
  input: Record<string, unknown>,
): Promise<TaskSummary> {
  requireScope(tenantId);
  const { statuses, workload, late, users } = await repo.findTaskSummary(
    tenantId,
    parseInput(TaskQuerySchema, input),
  );
  const byStatus: TaskSummary["byStatus"] = {
    pending: 0,
    in_progress: 0,
    blocked: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of statuses) {
    const status = TaskStatusSchema.safeParse(row.status);
    if (status.success) byStatus[status.data] += row._count._all;
  }
  const people = new Map(
    users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
  );
  const rows = new Map<string, TaskSummary["workload"][number]>();
  for (const entry of workload) {
    const row = rows.get(entry.assignedUserId) ?? {
      assignedUserId: entry.assignedUserId,
      name: people.get(entry.assignedUserId) ?? "Unavailable user",
      pending: 0,
      inProgress: 0,
      blocked: 0,
      overdue: 0,
      total: 0,
    };
    row.total += entry._count._all;
    if (entry.status === "pending") row.pending += entry._count._all;
    if (["in_progress", "in-progress"].includes(entry.status))
      row.inProgress += entry._count._all;
    if (entry.status === "blocked") row.blocked += entry._count._all;
    rows.set(entry.assignedUserId, row);
  }
  for (const entry of late) {
    const row = rows.get(entry.assignedUserId);
    if (row) row.overdue = entry._count._all;
  }
  return {
    total: statuses.reduce((sum, row) => sum + row._count._all, 0),
    active: [...rows.values()].reduce((sum, row) => sum + row.total, 0),
    completed: byStatus.completed,
    overdue: late.reduce((sum, row) => sum + row._count._all, 0),
    byStatus,
    workload: [...rows.values()].sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name),
    ),
  };
}
export async function getTaskOptions(
  tenantId: string,
  input: Record<string, unknown>,
) {
  requireScope(tenantId);
  const query = parseInput(TaskOptionsQuerySchema, input);
  return repo.findTaskOptions(tenantId, query.kind, query.search);
}
