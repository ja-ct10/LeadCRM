import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';

// Controllers
import * as contactController  from '../../modules/crm/contacts/contacts.controller';
import * as companyController  from '../../modules/crm/companies/companies.controller';
import * as dealController     from '../../modules/crm/deals/deals.controller';
import * as pipelineController from '../../modules/crm/pipeline/pipeline.controller';

// Schemas
import { CreateContactSchema, UpdateContactSchema }   from '../../modules/crm/contacts/contacts.dto';
import { CreateCompanySchema, UpdateCompanySchema }   from '../../modules/crm/companies/companies.dto';
import { CreateDealSchema, UpdateDealSchema, MoveDealStageSchema } from '../../modules/crm/deals/deals.dto';
import {
  CreatePipelineSchema, UpdatePipelineSchema,
  CreateStageSchema, UpdateStageSchema, ReorderStagesSchema,
} from '../../modules/crm/pipeline/pipeline.dto';

const router = Router();

// All CRM routes require authentication + tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Contacts ──────────────────────────────────────────
router.get(    '/contacts',            authorize('contacts.view'),   contactController.getContacts);
router.get(    '/contacts/:id',        authorize('contacts.view'),   contactController.getContactById);
router.post(   '/contacts',            authorize('contacts.create'), validate(CreateContactSchema), contactController.createContact);
router.put(    '/contacts/:id',        authorize('contacts.edit'),   validate(UpdateContactSchema), contactController.updateContact);
router.patch(  '/contacts/:id/archive',authorize('contacts.delete'), contactController.archiveContact);

// ── Companies (Organizations) ─────────────────────────
router.get(    '/companies',            authorize('contacts.view'),   companyController.getCompanies);
router.get(    '/companies/:id',        authorize('contacts.view'),   companyController.getCompanyById);
router.post(   '/companies',            authorize('contacts.create'), validate(CreateCompanySchema), companyController.createCompany);
router.put(    '/companies/:id',        authorize('contacts.edit'),   validate(UpdateCompanySchema), companyController.updateCompany);
router.patch(  '/companies/:id/archive',authorize('contacts.delete'), companyController.archiveCompany);

// ── Deals ─────────────────────────────────────────────
router.get(    '/deals',               authorize('deals.view'),   dealController.getDeals);
router.get(    '/deals/:id',           authorize('deals.view'),   dealController.getDealById);
router.post(   '/deals',               authorize('deals.create'), validate(CreateDealSchema),     dealController.createDeal);
router.put(    '/deals/:id',           authorize('deals.edit'),   validate(UpdateDealSchema),     dealController.updateDeal);
router.patch(  '/deals/:id/stage',     authorize('deals.edit'),   validate(MoveDealStageSchema),  dealController.moveDealStage);
router.patch(  '/deals/:id/archive',   authorize('deals.delete'), dealController.archiveDeal);

// ── Pipelines ─────────────────────────────────────────
router.get(    '/pipelines',                 authorize('deals.view'),    pipelineController.getPipelines);
router.get(    '/pipelines/:id',             authorize('deals.view'),    pipelineController.getPipelineById);
router.post(   '/pipelines',                 authorize('deals.create'),  validate(CreatePipelineSchema), pipelineController.createPipeline);
router.put(    '/pipelines/:id',             authorize('deals.edit'),    validate(UpdatePipelineSchema), pipelineController.updatePipeline);
router.patch(  '/pipelines/:id/archive',     authorize('deals.delete'),  pipelineController.archivePipeline);
router.delete( '/pipelines/:id',             authorize('deals.delete'),  pipelineController.deletePipeline);

// ── Stages (nested under pipeline context) ────────────
router.post(   '/stages',                    authorize('deals.create'),  validate(CreateStageSchema),    pipelineController.createStage);
router.put(    '/stages/:id',                authorize('deals.edit'),    validate(UpdateStageSchema),    pipelineController.updateStage);
router.delete( '/stages/:id',                authorize('deals.delete'),  pipelineController.deleteStage);
router.patch(  '/pipelines/:id/stages/reorder', authorize('deals.edit'), validate(ReorderStagesSchema),  pipelineController.reorderStages);

// ── Activities ─────────────────────────────────────────
import * as activityController from '../../modules/crm/activities/activities.controller';
import { CreateActivitySchema, UpdateActivitySchema } from '../../modules/crm/activities/activities.dto';

router.get(    '/activities',            authorize('contacts.view'),   activityController.getActivities);
router.get(    '/activities/:id',        authorize('contacts.view'),   activityController.getActivity);
router.post(   '/activities',            authorize('contacts.create'), validate(CreateActivitySchema), activityController.createActivity);
router.put(    '/activities/:id',        authorize('contacts.edit'),   validate(UpdateActivitySchema), activityController.updateActivity);
router.delete( '/activities/:id',        authorize('contacts.delete'), activityController.deleteActivity);

export default router;
