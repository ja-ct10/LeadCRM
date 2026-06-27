import { Router, raw } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';

import * as invoiceController  from '../../modules/billing/invoices/invoices.controller';
import * as paymentController  from '../../modules/billing/payments/payments.controller';

import {
  CreateInvoiceSchema, UpdateInvoiceSchema, MarkPaidSchema,
} from '../../modules/billing/invoices/invoices.dto';

const router = Router();

// ── PayMongo Webhook — NO auth, raw body for HMAC validation ──
// Must be registered BEFORE the json middleware is applied
router.post(
  '/webhooks/paymongo',
  raw({ type: 'application/json' }),
  paymentController.paymongoWebhook,
);

// ── All other billing routes require auth + tenant ─────
router.use(authMiddleware);
router.use(tenantMiddleware);

router.get(   '/invoices',              authorize('billing.view'),   invoiceController.getInvoices);
router.get(   '/invoices/:id',          authorize('billing.view'),   invoiceController.getInvoiceById);
router.post(  '/invoices',              authorize('billing.manage'), validate(CreateInvoiceSchema), invoiceController.createInvoice);
router.put(   '/invoices/:id',          authorize('billing.manage'), validate(UpdateInvoiceSchema), invoiceController.updateInvoice);
router.patch( '/invoices/:id/pay',      authorize('billing.manage'), validate(MarkPaidSchema),      invoiceController.markInvoicePaid);
router.patch( '/invoices/:id/archive',  authorize('billing.manage'), invoiceController.archiveInvoice);

export default router;
