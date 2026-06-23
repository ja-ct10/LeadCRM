import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';

const router = Router();

// All routes in this domain require authentication and tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// TODO: mount operations module routes here
// Example: router.use('/contacts', contactRoutes);

export default router;
