import type { Request, Response, NextFunction } from 'express';
import { ProductInterestConfigSchema } from '@leadcrm/shared';
import { productConfiguration, salesTransaction } from '../../crm/leads/lead-automation.service';
import { AppError } from '../../../shared/errors/app-error';
import { writeAuditLog } from '../../../core/audit/audit.service';

export async function get(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await salesTransaction(tx => productConfiguration(tx, req.user!.tenantId)) }); }
  catch (error) { next(error); }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'Client Admin') throw new AppError('Only Client Admin can configure Product Interests.', 403);
    const value = ProductInterestConfigSchema.parse(req.body);
    const tenantId = req.user!.tenantId;
    await salesTransaction(async tx => {
      const previous = await productConfiguration(tx, tenantId);
      // Preserve option identity and historical references; this screen edits monetary defaults.
      if (previous.length !== value.length || previous.some(p => !value.some(row => row.name === p.name))) throw new AppError('Keep the existing Product Interest names.', 400);
      await tx.tenantPreference.update({ where: { tenantId_module_key: { tenantId, module: 'product-interests', key: 'values' } }, data: { value } });
    });
    await writeAuditLog({ tenantId, userId: req.user!.userId, action: 'product_interests.updated', entityType: 'TenantPreference', entityId: tenantId, after: { products: value } });
    res.json({ success: true, data: value });
  } catch (error) { next(error); }
}
