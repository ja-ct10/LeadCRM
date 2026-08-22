import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';

// Controllers
import * as contactController      from '../../modules/crm/contacts/contacts.controller';
import * as contactsV2Controller   from '../../modules/crm/contacts-v2/contacts-v2.controller';
import * as leadImportController   from '../../modules/crm/lead-imports/lead-imports.controller';
import * as contactImportController from '../../modules/crm/contact-imports/contact-imports.controller';
import * as accountImportController from '../../modules/crm/account-imports/account-imports.controller';
import * as companyController      from '../../modules/crm/companies/companies.controller';
import * as dealController         from '../../modules/crm/deals/deals.controller';
import * as bulkDealsController    from '../../modules/crm/deals/bulk-deals.controller';
import * as pipelineController     from '../../modules/crm/pipeline/pipeline.controller';
import * as activityController     from '../../modules/crm/activities/activities.controller';
import * as duplicateDetectionController from '../../modules/crm/duplicate-detection/duplicate-detection.controller';
import * as mergeController            from '../../modules/crm/merge/merge.controller';
import * as relationshipsController    from '../../modules/crm/relationships/relationships.controller';

// Schemas
import { CreateContactSchema, UpdateContactSchema, ConvertContactSchema } from '../../modules/crm/contacts/contacts.dto';
import { CreateLeadImportSchema } from '../../modules/crm/lead-imports/lead-imports.dto';
import { CreateContactImportSchema } from '../../modules/crm/contact-imports/contact-imports.dto';
import { CreateAccountImportSchema } from '../../modules/crm/account-imports/account-imports.dto';
import { CreateCompanySchema, UpdateCompanySchema }                       from '../../modules/crm/companies/companies.dto';
import { CreateDealSchema, UpdateDealSchema, MoveDealStageSchema }        from '../../modules/crm/deals/deals.dto';
import {
  CreatePipelineSchema, UpdatePipelineSchema,
  CreateStageSchema, UpdateStageSchema, ReorderStagesSchema, ReorderDealsSchema,
} from '../../modules/crm/pipeline/pipeline.dto';
import { CreateActivitySchema, UpdateActivitySchema } from '../../modules/crm/activities/activities.dto';
import { DuplicateCheckSchema } from '../../modules/crm/duplicate-detection/duplicate-detection.dto';
import { MergePreviewSchema, MergeExecuteSchema } from '../../modules/crm/merge/merge.dto';

const router = Router();

// All CRM routes require authentication + tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// ── Duplicate Detection ───────────────────────────────────────────────────
router.post(  '/duplicate-check',    authorize('contacts.view'),   validate(DuplicateCheckSchema), duplicateDetectionController.duplicateCheck);

// ── Merge ─────────────────────────────────────────────────────────────────
router.post(  '/merge/preview',      authorize('contacts.edit'),   validate(MergePreviewSchema),  mergeController.mergePreview);
router.post(  '/merge',              authorize('contacts.edit'),   validate(MergeExecuteSchema),  mergeController.mergeExecute);

// ── Leads (canonical name; /contacts kept as alias for backward compat) ──
router.get(   '/leads',              authorize('contacts.view'),   contactController.getContacts);
router.get(   '/leads/imports',      authorize('contacts.view'),   leadImportController.listImports);
router.get(   '/leads/imports/:importId',         authorize('contacts.view'),   leadImportController.getImport);
router.get(   '/leads/imports/:importId/results', authorize('contacts.view'),   leadImportController.getImportResults);
router.post(  '/leads/imports',      authorize('contacts.create'), validate(CreateLeadImportSchema), leadImportController.createImport);
router.get(   '/leads/:id',          authorize('contacts.view'),   contactController.getContactById);
router.post(  '/leads',              authorize('contacts.create'), validate(CreateContactSchema),  contactController.createContact);
router.put(   '/leads/:id',          authorize('contacts.edit'),   validate(UpdateContactSchema),  contactController.updateContact);
router.patch( '/leads/:id/archive',  authorize('contacts.delete'), contactController.archiveContact);
router.post(  '/leads/:id/convert',  authorize('contacts.edit'),   validate(ConvertContactSchema), contactController.convertContact);
router.get(   '/leads/:id/relationships', authorize('contacts.view'), relationshipsController.getLeadRelationships);

// ── Contacts (reads from Contact table, separate from Leads) ─────────────────
router.get(   '/contacts',              authorize('contacts.view'),   contactsV2Controller.getContacts);
router.get(   '/contacts/imports',      authorize('contacts.view'),   contactImportController.listImports);
router.get(   '/contacts/imports/:importId',         authorize('contacts.view'),   contactImportController.getImport);
router.get(   '/contacts/imports/:importId/results', authorize('contacts.view'),   contactImportController.getImportResults);
router.post(  '/contacts/imports',      authorize('contacts.create'), validate(CreateContactImportSchema), contactImportController.createImport);
router.get(   '/contacts/:id',          authorize('contacts.view'),   contactsV2Controller.getContactById);
router.post(  '/contacts',              authorize('contacts.create'), contactsV2Controller.createContact);
router.put(   '/contacts/:id',          authorize('contacts.edit'),   contactsV2Controller.updateContact);
router.patch( '/contacts/:id/archive',  authorize('contacts.delete'), contactsV2Controller.archiveContact);
router.get(   '/contacts/:id/relationships', authorize('contacts.view'), relationshipsController.getContactRelationships);

// ── Accounts (canonical name; /companies kept as alias) ──────────────────
router.get(   '/accounts',              authorize('accounts.view'),   companyController.getCompanies);
router.get(   '/accounts/imports',      authorize('accounts.view'),   accountImportController.listImports);
router.get(   '/accounts/imports/:importId',         authorize('accounts.view'),   accountImportController.getImport);
router.get(   '/accounts/imports/:importId/results', authorize('accounts.view'),   accountImportController.getImportResults);
router.post(  '/accounts/imports',      authorize('accounts.create'), validate(CreateAccountImportSchema), accountImportController.createImport);
router.get(   '/accounts/:id',          authorize('accounts.view'),   companyController.getCompanyById);
router.post(  '/accounts',              authorize('accounts.create'), validate(CreateCompanySchema), companyController.createCompany);
router.put(   '/accounts/:id',          authorize('accounts.edit'),   validate(UpdateCompanySchema), companyController.updateCompany);
router.patch( '/accounts/:id/archive',  authorize('accounts.delete'), companyController.archiveCompany);
router.get(   '/accounts/:id/relationships', authorize('accounts.view'), relationshipsController.getAccountRelationships);

// Backward-compat aliases
router.get(   '/companies',             authorize('accounts.view'),   companyController.getCompanies);
router.get(   '/companies/:id',         authorize('accounts.view'),   companyController.getCompanyById);
router.post(  '/companies',             authorize('accounts.create'), validate(CreateCompanySchema), companyController.createCompany);
router.put(   '/companies/:id',         authorize('accounts.edit'),   validate(UpdateCompanySchema), companyController.updateCompany);
router.patch( '/companies/:id/archive', authorize('accounts.delete'), companyController.archiveCompany);

// ── Deals ─────────────────────────────────────────────────────────────────
router.get(   '/deals',              authorize('deals.view'),   dealController.getDeals);
router.get(   '/deals/forecast',     authorize('deals.view'),   dealController.getForecast);
// Bulk operations (must be before :id routes to avoid param capture)
router.post(  '/deals/bulk/archive',  authorize('deals.delete'), bulkDealsController.bulkArchive);
router.post(  '/deals/bulk/reassign', authorize('deals.edit'),   bulkDealsController.bulkReassign);
router.post(  '/deals/bulk/stage',    authorize('deals.edit'),   bulkDealsController.bulkStageChange);
router.get(   '/deals/:id',          authorize('deals.view'),   dealController.getDealById);
router.post(  '/deals',              authorize('deals.create'), validate(CreateDealSchema),    dealController.createDeal);
router.put(   '/deals/:id',          authorize('deals.edit'),   validate(UpdateDealSchema),    dealController.updateDeal);
router.patch( '/deals/:id/stage',    authorize('deals.edit'),   validate(MoveDealStageSchema), dealController.moveDealStage);
router.patch( '/deals/:id/archive',  authorize('deals.delete'), dealController.archiveDeal);
router.patch( '/deals/:id/restore',  authorize('deals.edit'),   dealController.restoreDeal);
router.post(  '/deals/:id/duplicate', authorize('deals.create'), dealController.duplicateDeal);
router.get(   '/deals/:id/relationships', authorize('deals.view'), relationshipsController.getDealRelationships);

// ── Pipelines ─────────────────────────────────────────────────────────────
router.get(    '/pipeline-templates',              authorize('deals.view'),   pipelineController.getPipelineTemplates);
router.get(    '/pipelines',                       authorize('deals.view'),   pipelineController.getPipelines);
router.get(    '/pipelines/:id',                   authorize('deals.view'),   pipelineController.getPipelineById);
router.post(   '/pipelines',                       authorize('deals.create'), validate(CreatePipelineSchema), pipelineController.createPipeline);
router.put(    '/pipelines/:id',                   authorize('deals.edit'),   validate(UpdatePipelineSchema), pipelineController.updatePipeline);
router.patch(  '/pipelines/:id/archive',           authorize('deals.delete'), pipelineController.archivePipeline);
router.delete( '/pipelines/:id',                   authorize('deals.delete'), pipelineController.deletePipeline);
router.post(   '/stages',                          authorize('deals.create'), validate(CreateStageSchema),    pipelineController.createStage);
router.put(    '/stages/:id',                      authorize('deals.edit'),   validate(UpdateStageSchema),    pipelineController.updateStage);
router.delete( '/stages/:id',                      authorize('deals.delete'), pipelineController.deleteStage);
router.patch(  '/pipelines/:id/stages/reorder',    authorize('deals.edit'),   validate(ReorderStagesSchema),  pipelineController.reorderStages);
router.patch(  '/pipelines/:id/deals/reorder',     authorize('deals.edit'),   validate(ReorderDealsSchema),   pipelineController.reorderDeals);

// ── Activities ─────────────────────────────────────────────────────────────
router.get(   '/activities',     authorize('contacts.view'),   activityController.getActivities);
router.get(   '/activities/:id', authorize('contacts.view'),   activityController.getActivity);
router.post(  '/activities',     authorize('contacts.create'), validate(CreateActivitySchema), activityController.createActivity);
router.put(   '/activities/:id', authorize('contacts.edit'),   validate(UpdateActivitySchema), activityController.updateActivity);
router.delete('/activities/:id', authorize('contacts.delete'), activityController.deleteActivity);

export default router;
