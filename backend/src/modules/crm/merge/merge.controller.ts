import { Request, Response, NextFunction } from 'express';
import * as mergeService from './merge.service';
import type { MergePreviewDto, MergeExecuteDto } from './merge.dto';

/**
 * POST /api/v1/crm/merge/preview
 * Returns a side-by-side comparison of two records for the merge UI.
 */
export async function mergePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = req.body as MergePreviewDto;
    const tenantId = req.user!.tenantId;

    const result = await mergeService.preview({
      tenantId,
      entityType: dto.entityType,
      primaryId: dto.primaryId,
      secondaryId: dto.secondaryId,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/crm/merge
 * Executes the merge — combines two records, reassigns relationships, archives secondary.
 */
export async function mergeExecute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = req.body as MergeExecuteDto;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const result = await mergeService.execute({
      tenantId,
      userId,
      entityType: dto.entityType,
      primaryId: dto.primaryId,
      secondaryId: dto.secondaryId,
      fieldResolutions: dto.fieldResolutions,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
