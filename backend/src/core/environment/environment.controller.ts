import type { Request, Response, NextFunction } from 'express';
import { changeEnvironment } from './environment.service';

export async function updateEnvironment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await changeEnvironment(req.user!.userId, req.user!.tenantId, req.body.environment);
    res.json({ success: true, data });
  } catch (error) { next(error); }
}
