import { Request, Response, NextFunction } from 'express';
import * as bulkService from './bulk-deals.service';
import { BulkArchiveSchema, BulkReassignSchema, BulkStageChangeSchema } from './deals.dto';

export async function bulkArchive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = BulkArchiveSchema.parse(req.body);
    const result = await bulkService.bulkArchive(req.user!.tenantId, req.user!.userId, dto);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function bulkReassign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = BulkReassignSchema.parse(req.body);
    const result = await bulkService.bulkReassign(req.user!.tenantId, req.user!.userId, dto);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function bulkStageChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = BulkStageChangeSchema.parse(req.body);
    const result = await bulkService.bulkStageChange(req.user!.tenantId, req.user!.userId, dto);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
