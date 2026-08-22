import { Request, Response, NextFunction } from 'express';
import { checkDuplicates } from './duplicate-detection.service';
import type { DuplicateCheckDto } from './duplicate-detection.dto';

/**
 * POST /api/v1/crm/duplicate-check
 * Checks for potential duplicate records across Leads, Contacts, and Accounts.
 */
export async function duplicateCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = req.body as DuplicateCheckDto;
    const tenantId = req.user!.tenantId;

    const result = await checkDuplicates({
      tenantId,
      email: dto.email,
      phone: dto.phone,
      firstName: dto.firstName,
      lastName: dto.lastName,
      companyName: dto.companyName,
      excludeId: dto.excludeId,
      entityTypes: dto.entityTypes,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
