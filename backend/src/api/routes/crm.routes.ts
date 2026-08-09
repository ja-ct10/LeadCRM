import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';

// Controllers
import * as contactController  from '../../modules/crm/leads/leads.controller';
import * as companyController  from '../../modules/crm/accounts/companies.controller';
import * as customerController from '../../modules/crm/customers/customers.controller';
import * as dealController     from '../../modules/crm/deals/deals.controller';
import * as pipelineController from '../../modules/crm/pipeline/pipeline.controller';
import * as activityController from '../../modules/crm/activities/activities.controller';

// Schemas
import { CreateLeadSchema as CreateContactSchema, UpdateLeadSchema as UpdateContactSchema, ConvertLeadSchema as ConvertContactSchema } from '../../modules/crm/leads/leads.dto';
import { CreateAccountSchema as CreateCompanySchema, UpdateAccountSchema as UpdateCompanySchema } from '../../modules/crm/accounts/companies.dto';
import { CreateCustomerSchema, UpdateCustomerSchema } from '../../modules/crm/customers/customers.dto';
import { CreateDealSchema, UpdateDealSchema, MoveDealStageSchema } from '../../modules/crm/deals/deals.dto';
import {
  CreatePipelineSchema, UpdatePipelineSchema,
  CreateStageSchema, UpdateStageSchema, ReorderStagesSchema, ReorderDealsSchema,
} from '../../modules/crm/pipeline/pipeline.dto';
import { CreateActivitySchema, UpdateActivitySchema } from '../../modules/crm/activities/activities.dto';

const router = Router();

// All CRM routes require authentication + tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Leads (Contacts) ─────────────────────────────────
router.get(    '/leads',             authorize('contacts.view'),   contactController.getLeads);
router.get(    '/leads/:id',         authorize('contacts.view'),   contactController.getLeadById);
router.post(   '/leads',             authorize('contacts.create'), validate(CreateContactSchema),  contactController.createLead);
router.put(    '/leads/:id',         authorize('contacts.edit'),   validate(UpdateContactSchema),  contactController.updateLead);
router.patch(  '/leads/:id/archive', authorize('contacts.delete'),                                 contactController.archiveLead);
router.post(   '/leads/:id/convert', authorize('contacts.edit'),   validate(ConvertContactSchema), contactController.convertLead);

// ── Accounts (Companies / Organizations) ─────────────
router.get(    '/accounts',             authorize('accounts.view'),   companyController.getCompanies);
router.get(    '/accounts/:id',         authorize('accounts.view'),   companyController.getAccountById);
router.post(   '/accounts',             authorize('accounts.create'), validate(CreateCompanySchema), companyController.createAccount);
router.put(    '/accounts/:id',         authorize('accounts.edit'),   validate(UpdateCompanySchema), companyController.updateAccount);
router.patch(  '/accounts/:id/archive', authorize('accounts.delete'),                               companyController.archiveAccount);

// ── Customers ─────────────────────────────────────────
router.get(    '/customers',             authorize('contacts.view'),   customerController.getCustomers);
router.get(    '/customers/:id',         authorize('contacts.view'),   customerController.getCustomerById);
router.post(   '/customers',             authorize('contacts.create'), validate(CreateCustomerSchema), customerController.createCustomer);
router.put(    '/customers/:id',         authorize('contacts.edit'),   validate(UpdateCustomerSchema), customerController.updateCustomer);
router.patch(  '/customers/:id/archive', authorize('contacts.delete'),                                 customerController.archiveCustomer);
router.post(   '/customers/:id/convert', authorize('contacts.edit'),                                   customerController.convertCustomer);

// ── Deals ─────────────────────────────────────────────
router.get(    '/deals',               authorize('deals.view'),   dealController.getDeals);
router.get(    '/deals/:id',           authorize('deals.view'),   dealController.getDealById);
router.post(   '/deals',               authorize('deals.create'), validate(CreateDealSchema),    dealController.createDeal);
router.put(    '/deals/:id',           authorize('deals.edit'),   validate(UpdateDealSchema),    dealController.updateDeal);
router.patch(  '/deals/:id/stage',     authorize('deals.edit'),   validate(MoveDealStageSchema), dealController.moveDealStage);
router.patch(  '/deals/:id/archive',   authorize('deals.delete'),                               dealController.archiveDeal);

// ── Pipelines ─────────────────────────────────────────
router.get(    '/pipeline-templates',           authorize('deals.view'),   pipelineController.getPipelineTemplates);
router.get(    '/pipelines',                    authorize('deals.view'),   pipelineController.getPipelines);
router.get(    '/pipelines/:id',                authorize('deals.view'),   pipelineController.getPipelineById);
router.post(   '/pipelines',                    authorize('deals.create'), validate(CreatePipelineSchema), pipelineController.createPipeline);
router.put(    '/pipelines/:id',                authorize('deals.edit'),   validate(UpdatePipelineSchema), pipelineController.updatePipeline);
router.patch(  '/pipelines/:id/archive',        authorize('deals.delete'),                               pipelineController.archivePipeline);
router.delete( '/pipelines/:id',                authorize('deals.delete'),                               pipelineController.deletePipeline);

// ── Stages ────────────────────────────────────────────
router.post(   '/stages',                          authorize('deals.create'), validate(CreateStageSchema),   pipelineController.createStage);
router.put(    '/stages/:id',                      authorize('deals.edit'),   validate(UpdateStageSchema),   pipelineController.updateStage);
router.delete( '/stages/:id',                      authorize('deals.delete'),                               pipelineController.deleteStage);
router.patch(  '/pipelines/:id/stages/reorder',    authorize('deals.edit'),   validate(ReorderStagesSchema), pipelineController.reorderStages);
router.patch(  '/pipelines/:id/deals/reorder',     authorize('deals.edit'),   validate(ReorderDealsSchema),  pipelineController.reorderDeals);

// ── Activities ────────────────────────────────────────
router.get(    '/activities',      authorize('contacts.view'),   activityController.getActivities);
router.get(    '/activities/:id',  authorize('contacts.view'),   activityController.getActivity);
router.post(   '/activities',      authorize('contacts.create'), validate(CreateActivitySchema), activityController.createActivity);
router.put(    '/activities/:id',  authorize('contacts.edit'),   validate(UpdateActivitySchema), activityController.updateActivity);
router.delete( '/activities/:id',  authorize('contacts.delete'),                                activityController.deleteActivity);

export default router;
