import { recordStaffOutreach } from '../customer-classification.service';
import { AppError } from '../../../shared/errors/app-error';
import { salesTransaction } from '../leads/lead-automation.service';
import { assertCrmRecordMutation, type CrmModule } from '../access/crm-record-access.service';
import type { Prisma } from '@prisma/client';
import * as activitiesRepository from './activities.repository';
import { CreateActivityDto, UpdateActivityDto } from './activities.dto';

export async function getActivities(tenantId: string, query: Record<string, unknown>) {
  return activitiesRepository.findAllActivities(tenantId, query);
}

export async function getActivity(id: string, tenantId: string) {
  const activity = await activitiesRepository.findActivityById(id, tenantId);
  if (!activity) {
    throw new AppError('Activity not found', 404);
  }
  const [visible] = await activitiesRepository.presentActivities(tenantId, [activity]);
  if (!visible) throw new AppError('Activity not found', 404);
  return visible;
}

export async function createActivity(tenantId: string, createdById: string, dto: CreateActivityDto) {
  if (dto.metadata?.legacyAccountNote) throw new AppError('Legacy note provenance is managed by migrations.', 403);
  if (dto.taskId || dto.type === 'task' || dto.metadata?.taskEvent) throw new AppError('Task history is recorded by Task operations.', 403);
  // Can add specific logic here later, like validation or side-effects based on activity type
  return salesTransaction(async tx => {
    await authorizeLinks(tx, dto);
    const activity = await activitiesRepository.createActivity(tenantId, createdById, dto, tx);
    if (dto.type === 'call' || dto.type === 'sms' && dto.metadata?.direction === 'outbound' && dto.metadata?.status === 'sent') {
      if (dto.leadId) await recordStaffOutreach(tx, tenantId, { leadId: dto.leadId }, activity.createdAt);
      if (dto.contactId) await recordStaffOutreach(tx, tenantId, { contactId: dto.contactId }, activity.createdAt);
    }
    return activity;
  });
}

export async function updateActivity(id: string, tenantId: string, dto: UpdateActivityDto) {
  const activity = await salesTransaction(async tx => {
    const current = await tx.activity.findFirst({ where: { id, tenantId } });
    if (!current) throw new AppError('Activity not found', 404);
    assertMutableActivity(current);
    if (dto.metadata?.legacyAccountNote) throw new AppError('Legacy note provenance is managed by migrations.', 403);
    if (dto.taskId || dto.type === 'task' || dto.metadata?.taskEvent) throw new AppError('Task history is recorded by Task operations.', 403);
    await authorizeLinks(tx, current);
    await authorizeLinks(tx, dto);
    return activitiesRepository.updateActivity(id, tenantId, dto, tx);
  });
  if (!activity) {
    throw new AppError('Activity not found or cannot be updated', 404);
  }
  return activity;
}

export async function deleteActivity(id: string, tenantId: string) {
  const activity = await salesTransaction(async tx => {
    const current = await tx.activity.findFirst({ where: { id, tenantId } });
    if (!current) throw new AppError('Activity not found', 404);
    assertMutableActivity(current);
    await authorizeLinks(tx, current);
    return activitiesRepository.deleteActivity(id, tenantId, tx);
  });
  if (!activity) {
    throw new AppError('Activity not found or cannot be deleted', 404);
  }
  return activity;
}

function assertMutableActivity(record: { taskId: string | null; type: string; metadata: Prisma.JsonValue | null }) {
  if ((record.metadata as { legacyAccountNote?: unknown } | null)?.legacyAccountNote) throw new AppError('Imported legacy notes preserve the original text. Add a new note instead.', 403);
  if (record.type === 'email') throw new AppError('Email history is managed through Inbox operations.', 403);
  if (record.taskId || record.type === 'task' || (record.metadata as { taskEvent?: unknown } | null)?.taskEvent) throw new AppError('Task lifecycle history cannot be changed or deleted.', 403);
}

async function authorizeLinks(tx: Prisma.TransactionClient, record: object) {
  for (const [key, module] of Object.entries({ leadId: 'leads', contactId: 'contacts', accountId: 'accounts', dealId: 'deals' })) {
    const id = (record as Record<string, unknown>)[key];
    if (id) await assertCrmRecordMutation(tx, module as CrmModule, String(id));
  }
}
