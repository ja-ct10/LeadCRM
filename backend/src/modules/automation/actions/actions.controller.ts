import { Request, Response, NextFunction } from 'express';
import { getAvailableActions } from './actions.service';

/** GET /api/v1/automation/actions — returns available action types for workflow builder */
export function getActions(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ success: true, data: getAvailableActions() });
  } catch (err) { next(err); }
}
