import { Router } from 'express';
import crmRoutes from './crm.routes';
import marketingRoutes from './marketing.routes';
import operationsRoutes from './operations.routes';
import automationRoutes from './automation.routes';
import administrationRoutes from './administration.routes';
import billingRoutes from './billing.routes';
import reportingRoutes from './reporting.routes';

const router = Router();

router.use('/crm', crmRoutes);
router.use('/marketing', marketingRoutes);
router.use('/operations', operationsRoutes);
router.use('/automation', automationRoutes);
router.use('/administration', administrationRoutes);
router.use('/billing', billingRoutes);
router.use('/reporting', reportingRoutes);

export default router;
