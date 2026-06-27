import { Request, Response, NextFunction } from 'express';
import * as service from './service-orders.service';

export async function getServiceOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.getServiceOrders(req.user!.tenantId, req.query as Record<string, unknown>);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getServiceOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getServiceOrderById(String(req.params.id), req.user!.tenantId) });
  } catch (err) { next(err); }
}

export async function createServiceOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await service.createServiceOrder(req.user!.tenantId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
}

export async function updateServiceOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.updateServiceOrder(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body) });
  } catch (err) { next(err); }
}

export async function completeServiceOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.completeServiceOrder(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body) });
  } catch (err) { next(err); }
}
