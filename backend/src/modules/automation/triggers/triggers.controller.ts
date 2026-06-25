import { Request, Response, NextFunction } from 'express';

const AVAILABLE_TRIGGERS = [
  { type: 'contact.created',          label: 'Contact Created',             entity: 'contact' },
  { type: 'contact.status_changed',   label: 'Contact Status Changed',      entity: 'contact' },
  { type: 'deal.created',             label: 'Deal Created',                entity: 'deal' },
  { type: 'deal.stage_changed',       label: 'Deal Stage Changed',          entity: 'deal' },
  { type: 'deal.closed_won',          label: 'Deal Closed Won',             entity: 'deal' },
  { type: 'deal.closed_lost',         label: 'Deal Closed Lost',            entity: 'deal' },
  { type: 'task.created',             label: 'Task Created',                entity: 'task' },
  { type: 'task.completed',           label: 'Task Completed',              entity: 'task' },
  { type: 'campaign.sent',            label: 'Campaign Sent',               entity: 'campaign' },
];

/** GET /api/v1/automation/triggers — returns available trigger types for workflow builder */
export function getTriggers(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ success: true, data: AVAILABLE_TRIGGERS });
  } catch (err) { next(err); }
}
