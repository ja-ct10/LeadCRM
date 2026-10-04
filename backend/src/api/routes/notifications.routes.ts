import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware, workspaceReadyMiddleware } from '../middleware/tenant.middleware';
import * as notificationController from '../../modules/notifications/notifications.controller';
import { DeleteNotificationsSchema } from '@leadcrm/shared';
import { validate } from '../middleware/validate.middleware';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(workspaceReadyMiddleware);

router.get(   '/',          notificationController.getNotifications);
router.patch( '/read-all',  notificationController.markAllRead);
router.patch( '/:id/read',  notificationController.markRead);
router.delete('/', validate(DeleteNotificationsSchema), notificationController.deleteNotifications);

export default router;
