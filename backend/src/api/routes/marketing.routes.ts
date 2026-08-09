import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import * as campaignController from '../../modules/marketing/campaigns/campaigns.controller';
import * as templateController from '../../modules/marketing/templates/templates.controller';
import * as smsController from '../../modules/marketing/sms/sms.controller';
import * as emailController from '../../modules/marketing/email/email.controller';
import { CreateCampaignSchema, UpdateCampaignSchema } from '../../modules/marketing/campaigns/campaigns.dto';
import { CreateTemplateSchema, UpdateTemplateSchema } from '../../modules/marketing/templates/templates.dto';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Campaigns ─────────────────────────────────────────
router.get(   '/campaigns',             authorize('campaigns.view'),   campaignController.getCampaigns);
router.get(   '/campaigns/:id',         authorize('campaigns.view'),   campaignController.getCampaignById);
router.post(  '/campaigns',             authorize('campaigns.create'), validate(CreateCampaignSchema), campaignController.createCampaign);
router.put(   '/campaigns/:id',         authorize('campaigns.edit'),   validate(UpdateCampaignSchema), campaignController.updateCampaign);
router.patch( '/campaigns/:id/send',    authorize('campaigns.send'),   campaignController.sendCampaign);
router.patch( '/campaigns/:id/archive', authorize('campaigns.delete'), campaignController.archiveCampaign);

// ── Templates ─────────────────────────────────────────
router.get(   '/templates',             authorize('campaigns.view'),   templateController.getTemplates);
router.get(   '/templates/:id',         authorize('campaigns.view'),   templateController.getTemplateById);
router.post(  '/templates',             authorize('campaigns.create'), validate(CreateTemplateSchema), templateController.createTemplate);
router.put(   '/templates/:id',         authorize('campaigns.edit'),   validate(UpdateTemplateSchema), templateController.updateTemplate);
router.patch( '/templates/:id/archive', authorize('campaigns.delete'), templateController.archiveTemplate);

// ── SMS Gateway ───────────────────────────────────────
router.post('/sms/send',         authorize('campaigns.send'), smsController.sendSms);
router.post('/sms/bulk',         authorize('campaigns.send'), smsController.sendBulkSms);
router.get( '/sms/queue',        authorize('campaigns.view'), smsController.getQueueStatus);
router.get( '/sms/queue/items',  authorize('campaigns.view'), smsController.getQueueItems);
router.post('/sms/queue/stop',   authorize('campaigns.send'), smsController.stopQueue);
router.post('/sms/queue/clear',  authorize('campaigns.send'), smsController.clearQueue);
router.post('/sms/validate',     authorize('campaigns.view'), smsController.validateNumber);

// ── Gmail Integration ─────────────────────────────────
router.get( '/gmail/status',     authorize('campaigns.view'), emailController.getGmailStatus);
router.get( '/gmail/auth-url',   authorize('campaigns.send'), emailController.getGmailAuthUrl);
router.get( '/gmail/callback',   emailController.handleGmailCallback); // No auth - OAuth callback
router.post('/gmail/disconnect', authorize('campaigns.send'), emailController.disconnectGmail);
router.post('/gmail/send',       authorize('campaigns.send'), emailController.sendEmail);
router.post('/gmail/bulk',       authorize('campaigns.send'), emailController.sendBulkEmail);

export default router;
