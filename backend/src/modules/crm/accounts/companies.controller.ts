import { Request, Response, NextFunction } from 'express';
import * as service from './companies.service';

export async function getCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.getCompanies(req.user!.tenantId, req.query as Record<string, unknown>);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getAccountById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getAccountById(String(req.params.id), req.user!.tenantId) });
  } catch (err) { next(err); }
}

export async function createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await service.createAccount(req.user!.tenantId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: account });
  } catch (err) { next(err); }
}

export async function updateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.updateAccount(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body) });
  } catch (err) { next(err); }
}

export async function archiveAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.archiveAccount(String(req.params.id), req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}
