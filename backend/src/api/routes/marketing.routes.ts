import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import * as campaignController from '../../modules/marketing/campaigns/campaigns.controller';
import * as templateController from '../../modules/marketing/templates/templates.controller';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Campaigns ─────────────────────────────────────────
router.get(   '/campaigns',          authorize('campaigns.view'),   campaignController.getCampaigns);
router.get(   '/campaigns/:id',      authorize('campaigns.view'),   campaignController.getCampaignById);
router.post(  '/campaigns',          authorize('campaigns.create'), campaignController.createCampaign);
router.put(   '/campaigns/:id',      authorize('campaigns.edit'),   campaignController.updateCampaign);
router.patch( '/campaigns/:id/send', authorize('campaigns.send'),   campaignController.sendCampaign);
router.patch( '/campaigns/:id/archive', authorize('campaigns.delete'), campaignController.archiveCampaign);

// ── Templates ─────────────────────────────────────────
router.get(   '/templates',          authorize('campaigns.view'),   templateController.getTemplates);
router.get(   '/templates/:id',      authorize('campaigns.view'),   templateController.getTemplateById);
router.post(  '/templates',          authorize('campaigns.create'), templateController.createTemplate);
router.put(   '/templates/:id',      authorize('campaigns.edit'),   templateController.updateTemplate);
router.patch( '/templates/:id/archive', authorize('campaigns.delete'), templateController.archiveTemplate);

export default router;
