import type { Request, Response, NextFunction } from 'express';
import { CrmPhoneAvailabilityQuerySchema, type PhoneAvailability } from '@leadcrm/shared';
import { ZodError } from 'zod';
import prisma from '../../config/database.config';
import { assertExternalCustomerPhone } from './record-validation';

export async function phoneAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone } = CrmPhoneAvailabilityQuerySchema.parse(req.query);
    let data: PhoneAvailability = { available: true };
    try { await assertExternalCustomerPhone(prisma, req.user!.tenantId, phone); }
    catch (error) {
      if (!(error instanceof ZodError)) throw error;
      data = { available: false, reason: 'STAFF_PHONE_NOT_ALLOWED' };
    }
    res.set('Cache-Control', 'no-store').json({ success: true, data });
  } catch (error) { next(error); }
}
