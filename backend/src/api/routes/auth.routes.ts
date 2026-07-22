import { Router } from 'express';
import { authRateLimiter } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { LoginSchema } from '../../core/auth/auth.dto';
import * as authController from '../../core/auth/auth.controller';

const router = Router();

// POST /api/v1/auth/login — rate-limited, validated
router.post('/login', authRateLimiter, validate(LoginSchema), authController.login);

// POST /api/v1/auth/logout — revokes session + clears HttpOnly cookie
router.post('/logout', authController.logout);

// GET /api/v1/auth/me — returns current user from token (session-validated)
router.get('/me', authMiddleware, authController.me);

export default router;
