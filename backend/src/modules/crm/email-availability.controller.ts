import type { Request, Response, NextFunction } from 'express';
import { CrmEmailAvailabilityQuerySchema } from '@leadcrm/shared';
import { customerEmailAvailability } from '../administration/users/user-email';

export async function emailAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = CrmEmailAvailabilityQuerySchema.parse(req.query);
    res.set('Cache-Control', 'no-store').json({ success: true, data: await customerEmailAvailability(req.user!.tenantId, email) });
  } catch (error) { next(error); }
}
