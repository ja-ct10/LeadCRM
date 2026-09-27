import { assertPermissions } from '../../../core/permissions/permission.service';
import { AppError } from '../../../shared/errors/app-error';
import { Request, Response, NextFunction } from 'express';
import * as relationshipsService from './relationships.service';

async function mayReadTasks(req: Request): Promise<boolean> {
  try { await assertPermissions(req.user!, ['deals.view']); return true; }
  catch (error) { if (error instanceof AppError && error.statusCode === 403) return false; throw error; }
}

/**
 * GET /api/v1/crm/leads/:id/relationships
 */
export async function getLeadRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const tenantId = req.user!.tenantId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const data = await relationshipsService.getLeadRelationships(id, tenantId, limit, await mayReadTasks(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/crm/contacts/:id/relationships
 */
export async function getContactRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const tenantId = req.user!.tenantId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const data = await relationshipsService.getContactRelationships(id, tenantId, limit, await mayReadTasks(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/crm/accounts/:id/relationships
 */
export async function getAccountRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const tenantId = req.user!.tenantId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const data = await relationshipsService.getAccountRelationships(id, tenantId, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/crm/deals/:id/relationships
 */
export async function getDealRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const tenantId = req.user!.tenantId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const data = await relationshipsService.getDealRelationships(id, tenantId, limit, await mayReadTasks(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
