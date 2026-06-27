import { Request, Response, NextFunction } from 'express';
import * as service from './deals.service';

export async function getDeals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.getDeals(req.user!.tenantId, req.query as Record<string, unknown>);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getDealById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deal = await service.getDealById(String(req.params.id), req.user!.tenantId);
    res.json({ success: true, data: deal });
  } catch (err) { next(err); }
}

export async function createDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deal = await service.createDeal(req.user!.tenantId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: deal });
  } catch (err) { next(err); }
}

export async function updateDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deal = await service.updateDeal(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body);
    res.json({ success: true, data: deal });
  } catch (err) { next(err); }
}

export async function moveDealStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.moveDealStage(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function archiveDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.archiveDeal(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body?.archiveReason);
    res.status(204).send();
  } catch (err) { next(err); }
}
