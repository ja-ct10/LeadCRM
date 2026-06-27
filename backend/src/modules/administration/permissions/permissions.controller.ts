import { Request, Response, NextFunction } from 'express';
import { getAllPermissions } from './permissions.service';

/** GET /api/v1/administration/permissions
 *  Returns the canonical permission list grouped by module.
 *  Used by the frontend role builder to render permission checkboxes.
 */
export function getPermissions(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ success: true, data: getAllPermissions() });
  } catch (err) { next(err); }
}
