import { AppError } from '../../../shared/errors/app-error';
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
  return activitiesRepository.createActivity(tenantId, createdById, dto);
}

export async function updateActivity(id: string, tenantId: string, dto: UpdateActivityDto) {
  const activity = await activitiesRepository.updateActivity(id, tenantId, dto);
  if (!activity) {
    throw new AppError('Activity not found or cannot be updated', 404);
  }
  return activity;
}

export async function deleteActivity(id: string, tenantId: string) {
  const activity = await activitiesRepository.deleteActivity(id, tenantId);
  if (!activity) {
    throw new AppError('Activity not found or cannot be deleted', 404);
  }
  return activity;
}
