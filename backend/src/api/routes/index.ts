import { brevoWebhookRouter } from '../../modules/marketing/campaigns/brevo-webhook';
import { textbeeWebhookRouter } from '../../modules/marketing/campaigns/textbee-webhook';
import { smsLinkRouter } from '../../modules/marketing/campaigns/sms-link-tracking';
import { Router } from 'express';
import authRoutes from './auth.routes';
import crmRoutes from './crm.routes';
import marketingRoutes from './marketing.routes';
import operationsRoutes from './operations.routes';
import automationRoutes from './automation.routes';
import administrationRoutes from './administration.routes';
import reportingRoutes from './reporting.routes';
import integrationsRoutes from './integrations.routes';
import notificationsRoutes from './notifications.routes';
import preferencesRoutes from '../../modules/preferences/preferences.routes';
import tablePreferencesRoutes from '../../modules/preferences/table-preferences.routes';
import { publicFormsRouter } from './public-forms.routes';

const router = Router();
router.use('/webhooks/textbee', textbeeWebhookRouter);

// ── Health / version check ────────────────────────────────────────────────────
// Unauthenticated — used to confirm the serving revision on either host.
// GET /api/v1/health  →  { status, commit, env }
router.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    commit:    process.env.SOURCE_COMMIT ?? process.env.RENDER_GIT_COMMIT ?? 'unknown',
    env:       process.env.NODE_ENV ?? 'development',
    capabilities: ['canonical-crm-relations-v1', 'lead-form-contract-v1', 'contact-retirement-contract-v1', 'accounts-full-address-contract-v1', 'accounts-field-retirement-v1', 'accounts-activity-notes-v1'],
  });
});

router.use('/webhooks/brevo', brevoWebhookRouter);
router.use('/public/forms', publicFormsRouter);
router.use('/public/sms-links', smsLinkRouter);
router.use('/auth', authRoutes);
router.use('/crm', crmRoutes);
router.use('/marketing', marketingRoutes);
router.use('/operations', operationsRoutes);
router.use('/automation', automationRoutes);
router.use('/administration', administrationRoutes);
router.use('/reporting', reportingRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/preferences/columns', preferencesRoutes);
router.use('/preferences/table', tablePreferencesRoutes);



export default router;
