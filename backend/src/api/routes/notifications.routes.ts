import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import * as notificationController from '../../modules/notifications/notifications.controller';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get(   '/',          notificationController.getNotifications);
router.patch( '/read-all',  notificationController.markAllRead);
router.patch( '/:id/read',  notificationController.markRead);

export default router;
