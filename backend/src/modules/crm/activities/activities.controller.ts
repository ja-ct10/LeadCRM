import { Request, Response, NextFunction } from 'express';
import { CreateActivitySchema, UpdateActivitySchema } from './activities.dto';
import * as activitiesService from './activities.service';

export async function getActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await activitiesService.getActivities(tenantId, req.query);
    res.json({ success: true, ...result, meta: { total: result.total, page: result.page, limit: result.limit, hasMore: !!result.nextCursor } });
  } catch (error) { next(error); }
}

export async function getActivity(req: Request, res: Response) {
  const tenantId = req.user!.tenantId as string;
  const activity = await activitiesService.getActivity(req.params.id as string, tenantId);
  res.json({ success: true, data: activity });
}

export async function createActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId as string;
    const userId = req.user!.userId as string;
    const dto = CreateActivitySchema.parse(req.body);
    const activity = await activitiesService.createActivity(tenantId, userId, dto);
    res.status(201).json({ success: true, data: activity });
  } catch (error) { next(error); }
}

export async function updateActivity(req: Request, res: Response) {
  const tenantId = req.user!.tenantId as string;
  const dto = UpdateActivitySchema.parse(req.body);
  const activity = await activitiesService.updateActivity(req.params.id as string, tenantId, dto);
  res.json({ success: true, data: activity });
}

export async function deleteActivity(req: Request, res: Response) {
  const tenantId = req.user!.tenantId as string;
  await activitiesService.deleteActivity(req.params.id as string, tenantId);
  res.json({ success: true, message: 'Activity deleted successfully' });
}
