import { Request, Response, NextFunction } from 'express';
import * as service from './roles.service';

export async function getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getRoles(req.user!.tenantId) });
  } catch (err) { next(err); }
}

export async function getRoleById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.getRoleById(String(req.params.id), req.user!.tenantId) });
  } catch (err) { next(err); }
}

export async function createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = await service.createRole(req.user!.tenantId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: role });
  } catch (err) { next(err); }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.updateRole(String(req.params.id), req.user!.tenantId, req.user!.userId, req.body) });
  } catch (err) { next(err); }
}

export async function archiveRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.archiveRole(String(req.params.id), req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function assignRoleToUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId } = req.body as { userId: string; roleId: string };
    res.json({ success: true, data: await service.assignRoleToUser(userId, roleId, req.user!.tenantId, req.user!.userId) });
  } catch (err) { next(err); }
}

export async function removeRoleFromUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId } = req.body as { userId: string; roleId: string };
    await service.removeRoleFromUser(userId, roleId, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}
