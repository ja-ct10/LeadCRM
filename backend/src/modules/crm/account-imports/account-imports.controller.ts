import { Request, Response, NextFunction } from 'express';
import * as service from './account-imports.service';
import { ListAccountImportsQuerySchema, ListAccountImportResultsQuerySchema } from './account-imports.dto';

export async function createImport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.processImport(
      req.user!.tenantId,
      req.user!.userId,
      req.body,
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listImports(req: Request, res: Response, next: NextFunction) {
  try {
    const query = ListAccountImportsQuerySchema.parse(req.query);
    const result = await service.listImports(req.user!.tenantId, query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getImport(req: Request, res: Response, next: NextFunction) {
  try {
    const importId = String(req.params.importId);
    const result = await service.getImportById(importId, req.user!.tenantId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getImportResults(req: Request, res: Response, next: NextFunction) {
  try {
    const importId = String(req.params.importId);
    const query = ListAccountImportResultsQuerySchema.parse(req.query);
    const result = await service.listImportResults(importId, req.user!.tenantId, query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
