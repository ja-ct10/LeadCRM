import { Request, Response, NextFunction } from 'express';
import * as service from './reports.service';

export async function getPipelineSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getPipelineSummary(req.user!.tenantId, req.query.pipelineId as string | undefined) });
  } catch (err) { next(err); }
}
export async function getDealVelocity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.getDealVelocity(req.user!.tenantId) }); } catch (err) { next(err); }
}
export async function getContactStatusBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.getContactStatusBreakdown(req.user!.tenantId) }); } catch (err) { next(err); }
}
export async function getTaskCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.getTaskCompletion(req.user!.tenantId) }); } catch (err) { next(err); }
}
export async function getCampaignSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.getCampaignSummary(req.user!.tenantId) }); } catch (err) { next(err); }
}
