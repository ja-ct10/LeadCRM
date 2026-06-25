import { Request, Response, NextFunction } from 'express';
import * as service from './users.service';

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, ...await service.getUsers(req.user!.tenantId, req.query as Record<string, unknown>) });
  } catch (err) { next(err); }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getUserById(String(req.params.id), req.user!.tenantId) });
  } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await service.createUser(req.user!.tenantId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.updateUser(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body) });
  } catch (err) { next(err); }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deactivateUser(String(req.params.id), req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}
