import { Request, Response, NextFunction } from 'express';
import * as relationshipsService from './relationships.service';

/**
 * GET /api/v1/crm/leads/:id/relationships
 */
export async function getLeadRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    const tenantId = req.user!.tenantId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const data = await relationshipsService.getLeadRelationships(id, tenantId, limit);
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

    const data = await relationshipsService.getContactRelationships(id, tenantId, limit);
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

    const data = await relationshipsService.getDealRelationships(id, tenantId, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
