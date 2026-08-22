import { Request, Response, NextFunction } from 'express';
import * as service from './contact-imports.service';
import { ListContactImportsQuerySchema, ListContactImportResultsQuerySchema } from './contact-imports.dto';

export async function createImport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.processImport(req.user!.tenantId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function listImports(req: Request, res: Response, next: NextFunction) {
  try {
    const query = ListContactImportsQuerySchema.parse(req.query);
    const result = await service.listImports(req.user!.tenantId, query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getImport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getImportById(String(req.params.importId), req.user!.tenantId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getImportResults(req: Request, res: Response, next: NextFunction) {
  try {
    const query = ListContactImportResultsQuerySchema.parse(req.query);
    const result = await service.listImportResults(String(req.params.importId), req.user!.tenantId, query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}
