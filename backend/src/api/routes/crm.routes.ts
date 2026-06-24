import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import * as contactController from '../../modules/crm/contacts/contacts.controller';
import { CreateContactSchema, UpdateContactSchema } from '../../modules/crm/contacts/contacts.dto';

const router = Router();

// All CRM routes require authentication and tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// Contacts
router.get('/contacts', authorize('contacts.view'), contactController.getContacts);
router.get('/contacts/:id', authorize('contacts.view'), contactController.getContactById);
router.post('/contacts', authorize('contacts.create'), validate(CreateContactSchema), contactController.createContact);
router.put('/contacts/:id', authorize('contacts.edit'), validate(UpdateContactSchema), contactController.updateContact);
router.patch('/contacts/:id/archive', authorize('contacts.delete'), contactController.archiveContact);

// TODO: wire companies, deals, pipeline routes as modules are built

export default router;
