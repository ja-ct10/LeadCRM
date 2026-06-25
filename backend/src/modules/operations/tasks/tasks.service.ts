import * as repo from './tasks.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';
import { paginate } from '../../../shared/helpers/pagination';

export async function getTasks(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllTasks(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getTaskById(id: string, tenantId: string) {
  const task = await repo.findTaskById(id, tenantId);
  if (!task) throw new NotFoundError('Task');
  return task;
}

export async function createTask(tenantId: string, userId: string, dto: CreateTaskDto) {
  const task = await repo.createTask(tenantId, userId, dto);
  await writeAuditLog({
    tenantId, userId,
    action: 'task.created', entityType: 'Task', entityId: task.id,
    after: { title: dto.title, assignedUserId: dto.assignedUserId, dueDate: dto.dueDate },
  });
  return task;
}

export async function updateTask(
  id: string, tenantId: string, userId: string, dto: UpdateTaskDto,
) {
  const task = await repo.updateTask(id, tenantId, dto);
  if (!task) throw new NotFoundError('Task');
  await writeAuditLog({
    tenantId, userId,
    action: 'task.updated', entityType: 'Task', entityId: id,
    after: dto as Record<string, unknown>,
  });
  return task;
}

export async function completeTask(id: string, tenantId: string, userId: string) {
  const task = await repo.completeTask(id, tenantId, userId);
  if (!task) throw new NotFoundError('Task');
  await writeAuditLog({
    tenantId, userId,
    action: 'task.completed', entityType: 'Task', entityId: id,
    after: { status: 'completed', completedById: userId },
  });
  return task;
}

export async function archiveTask(id: string, tenantId: string, userId: string) {
  const task = await repo.archiveTask(id, tenantId);
  if (!task) throw new NotFoundError('Task');
  await writeAuditLog({
    tenantId, userId,
    action: 'task.archived', entityType: 'Task', entityId: id,
    after: { isArchived: true },
  });
  return task;
}
