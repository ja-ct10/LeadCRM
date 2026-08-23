import { Request, Response, NextFunction } from 'express';
import * as service from './tenants.service';

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.listTenants() });
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.deactivateTenant(String(req.params.id), req.user!.userId) });
  } catch (err) {
    next(err);
  }
}

export async function activate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await service.activateTenant(String(req.params.id), req.user!.userId) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.createTenant(req.body, req.user!.userId);
    res.status(201).json({
      success: true,
      data: {
        tenant: result.tenant,
        adminUser: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
}
