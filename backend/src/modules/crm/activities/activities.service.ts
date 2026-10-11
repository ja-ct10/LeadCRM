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
  return activity;
}

export async function createActivity(tenantId: string, createdById: string, dto: CreateActivityDto) {
  // Can add specific logic here later, like validation or side-effects based on activity type
  return salesTransaction(async tx => {
    await authorizeLinks(tx, dto);
    return activitiesRepository.createActivity(tenantId, createdById, dto, tx);
  });
}

export async function updateActivity(id: string, tenantId: string, dto: UpdateActivityDto) {
  const activity = await salesTransaction(async tx => {
    const current = await tx.activity.findFirst({ where: { id, tenantId } });
    if (!current) throw new AppError('Activity not found', 404);
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
    await authorizeLinks(tx, current);
    return activitiesRepository.deleteActivity(id, tenantId, tx);
  });
  if (!activity) {
    throw new AppError('Activity not found or cannot be deleted', 404);
  }
  return activity;
}

async function authorizeLinks(tx: Prisma.TransactionClient, record: object) {
  for (const [key, module] of Object.entries({ leadId: 'leads', contactId: 'contacts', accountId: 'accounts', dealId: 'deals' })) {
    const id = (record as Record<string, unknown>)[key];
    if (id) await assertCrmRecordMutation(tx, module as CrmModule, String(id));
  }
}
