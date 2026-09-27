import { Prisma } from "@prisma/client";
import { TaskQuery, TaskOptionKind } from "@leadcrm/shared";
import prisma from "../../../config/database.config";
import { ConflictError } from "../../../shared/errors/http-error";

export type TaskClient = Pick<
  Prisma.TransactionClient,
  "task" | "user" | "lead" | "contact" | "deal" | "account"
>;
const person = {
  id: true,
  firstName: true,
  lastName: true,
  tenantId: true,
} as const;
export const taskInclude = {
  assignedUser: { select: person },
  assignedBy: { select: person },
  completedBy: { select: person },
  lead: { select: { ...person, environment: true } },
  contact: { select: { ...person, environment: true } },
  deal: {
    select: { id: true, title: true, tenantId: true, environment: true },
  },
} satisfies Prisma.TaskInclude;
export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export async function withTaskTransaction<T>(
  work: (client: TaskClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new ConflictError(
        "This task changed while you were editing. Refresh and try again.",
      );
    }
    throw error;
  }
}

export function taskWhere(
  tenantId: string,
  query: TaskQuery,
  now = new Date(),
): Prisma.TaskWhereInput {
  const AND: Prisma.TaskWhereInput[] = [];
  if (query.status)
    AND.push({
      status:
        query.status === "in_progress"
          ? { in: ["in_progress", "in-progress"] }
          : query.status,
    });
  if (query.state === "active")
    AND.push({ status: { notIn: ["completed", "cancelled"] } });
  if (query.state === "completed") AND.push({ status: "completed" });
  if (query.overdue)
    AND.push({
      isArchived: false,
      dueDate: { lt: now },
      status: { notIn: ["completed", "cancelled"] },
    });
  if (query.dueFrom || query.dueTo)
    AND.push({
      dueDate: {
        ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
        ...(query.dueTo ? { lt: new Date(query.dueTo) } : {}),
      },
    });
  return {
    tenantId,
    isArchived: query.archived,
    AND,
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.dealId ? { dealId: query.dealId } : {}),
    ...(query.accountId ? { accountId: query.accountId } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
export async function findAllTasks(tenantId: string, query: TaskQuery) {
  const where = taskWhere(tenantId, query);
  const [data, total] = await prisma.$transaction(
    [
      prisma.task.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
        include: taskInclude,
      }),
      prisma.task.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return { data, total, page: query.page, limit: query.limit };
}
export function findTaskById(
  id: string,
  tenantId: string,
  client: TaskClient = prisma,
) {
  return client.task.findFirst({
    where: { id, tenantId },
    include: taskInclude,
  });
}
export function findTaskUser(
  id: string,
  tenantId: string,
  client: TaskClient = prisma,
) {
  return client.user.findFirst({
    where: {
      id,
      tenantId,
      status: "ACTIVE",
      role: { notIn: ["System Admin", "Guest"] },
    },
    select: person,
  });
}
export function findTaskLink(
  kind: Exclude<TaskOptionKind, "user">,
  id: string,
  tenantId: string,
  client: TaskClient = prisma,
) {
  const where = { id, tenantId, isArchived: false };
  switch (kind) {
    case "lead":
      return client.lead.findFirst({ where, select: { id: true } });
    case "contact":
      return client.contact.findFirst({ where, select: { id: true } });
    case "deal":
      return client.deal.findFirst({ where, select: { id: true } });
    case "account":
      return client.account.findFirst({ where, select: { id: true } });
  }
}
export function createTask(
  data: Prisma.TaskUncheckedCreateInput,
  client: TaskClient,
) {
  return client.task.create({ data, include: taskInclude });
}
export function updateTask(
  id: string,
  tenantId: string,
  data: Prisma.TaskUncheckedUpdateInput,
  client: TaskClient,
) {
  return client.task.update({
    where: { id, tenantId },
    data,
    include: taskInclude,
  });
}
export async function findTaskSummary(tenantId: string, query: TaskQuery) {
  const where = taskWhere(tenantId, query);
  const active = {
    AND: [
      where,
      { isArchived: false, status: { notIn: ["completed", "cancelled"] } },
    ],
  };
  const overdue = {
    AND: [active, { dueDate: { lt: new Date() }, isArchived: false }],
  };
  return prisma.$transaction(
    async (tx) => {
      const [statuses, workload, late, users] = await Promise.all([
        tx.task.groupBy({ by: ["status"], where, _count: { _all: true } }),
        tx.task.groupBy({
          by: ["assignedUserId", "status"],
          where: active,
          _count: { _all: true },
        }),
        tx.task.groupBy({
          by: ["assignedUserId"],
          where: overdue,
          _count: { _all: true },
        }),
        tx.user.findMany({ where: { tenantId }, select: person }),
      ]);
      return { statuses, workload, late, users };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export async function findTaskOptions(
  tenantId: string,
  kind: TaskOptionKind,
  search: string,
) {
  const contains = { contains: search, mode: "insensitive" as const };
  const people = {
    OR: [{ firstName: contains }, { lastName: contains }, { email: contains }],
  };
  if (kind === "user") {
    const rows = await prisma.user.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        role: { notIn: ["System Admin", "Guest"] },
        ...people,
      },
      take: 50,
      orderBy: [{ firstName: "asc" }, { id: "asc" }],
      select: person,
    });
    return rows.map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`.trim(),
    }));
  }
  const where = { tenantId, isArchived: false };
  if (kind === "lead" || kind === "contact") {
    const args = {
      where: { ...where, ...people },
      take: 50,
      orderBy: [{ firstName: "asc" as const }, { id: "asc" as const }],
      select: { ...person, email: true },
    };
    const rows =
      kind === "lead"
        ? await prisma.lead.findMany(args)
        : await prisma.contact.findMany(args);
    return rows.map((row) => ({
      id: row.id,
      label:
        `${row.firstName} ${row.lastName}`.trim() +
        (row.email ? ` · ${row.email}` : ""),
    }));
  }
  if (kind === "deal") {
    const rows = await prisma.deal.findMany({
      where: { ...where, title: contains },
      take: 50,
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: { id: true, title: true },
    });
    return rows.map((row) => ({ id: row.id, label: row.title }));
  }
  const rows = await prisma.account.findMany({
    where: { ...where, name: contains },
    take: 50,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  return rows.map((row) => ({ id: row.id, label: row.name }));
}

export function findTaskAccounts(tenantId: string, ids: string[]) {
  return prisma.account.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, name: true },
  });
}
