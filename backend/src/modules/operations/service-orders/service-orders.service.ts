import * as repo from './service-orders.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { CreateServiceOrderDto, UpdateServiceOrderDto, CompleteServiceOrderDto } from './service-orders.dto';
import { paginate } from '../../../shared/helpers/pagination';

export async function getServiceOrders(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllServiceOrders(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getServiceOrderById(id: string, tenantId: string) {
  const order = await repo.findServiceOrderById(id, tenantId);
  if (!order) throw new NotFoundError('Service Order');
  return order;
}

export async function createServiceOrder(tenantId: string, userId: string, dto: CreateServiceOrderDto) {
  const order = await repo.createServiceOrder(tenantId, dto);
  await writeAuditLog({
    tenantId, userId,
    action: 'service_order.created', entityType: 'ServiceOrder', entityId: order.id,
    after: { title: dto.title, scheduledDate: dto.scheduledDate, assignedTechnicianId: dto.assignedTechnicianId },
  });
  return order;
}

export async function updateServiceOrder(
  id: string, tenantId: string, userId: string, dto: UpdateServiceOrderDto,
) {
  const order = await repo.updateServiceOrder(id, tenantId, dto);
  if (!order) throw new NotFoundError('Service Order');
  await writeAuditLog({
    tenantId, userId,
    action: 'service_order.updated', entityType: 'ServiceOrder', entityId: id,
    after: dto as Record<string, unknown>,
  });
  return order;
}

export async function completeServiceOrder(
  id: string, tenantId: string, userId: string, dto: CompleteServiceOrderDto,
) {
  const order = await repo.completeServiceOrder(id, tenantId, dto);
  if (!order) throw new NotFoundError('Service Order');
  await writeAuditLog({
    tenantId, userId,
    action: 'service_order.completed', entityType: 'ServiceOrder', entityId: id,
    after: { status: 'completed', completedAt: new Date() },
  });
  return order;
}
