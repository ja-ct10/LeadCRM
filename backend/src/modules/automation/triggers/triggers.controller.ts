import { Request, Response } from 'express';
import { WORKFLOW_TRIGGERS } from './trigger-catalog';
export function getTriggers(_req: Request, res: Response): void {
  res.json({ success: true, data: WORKFLOW_TRIGGERS });
}
