import { Request, Response, NextFunction } from 'express';
import * as service from './lead-imports.service';
import { ListImportsQuerySchema, ListImportResultsQuerySchema } from './lead-imports.dto';

/**
 * POST /crm/leads/imports
 * Start a new lead import from parsed CSV data.
 */
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

/**
 * GET /crm/leads/imports
 * List all imports for this tenant (paginated).
 */
export async function listImports(req: Request, res: Response, next: NextFunction) {
  try {
    const query = ListImportsQuerySchema.parse(req.query);
    const result = await service.listImports(req.user!.tenantId, query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /crm/leads/imports/:importId
 * Get a single import's summary.
 */
export async function getImport(req: Request, res: Response, next: NextFunction) {
  try {
    const importId = String(req.params.importId);
    const result = await service.getImportById(importId, req.user!.tenantId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /crm/leads/imports/:importId/results
 * Get paginated row results for an import.
 */
export async function getImportResults(req: Request, res: Response, next: NextFunction) {
  try {
    const importId = String(req.params.importId);
    const query = ListImportResultsQuerySchema.parse(req.query);
    const result = await service.listImportResults(importId, req.user!.tenantId, query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
