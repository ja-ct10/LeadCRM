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

import { ClientAdminRegisterSchema, GuestRegisterSchema } from '../../core/auth/auth.dto';

// POST /api/v1/auth/register/client-admin
router.post('/register/client-admin', authRateLimiter, validate(ClientAdminRegisterSchema), authController.registerClientAdmin);

// POST /api/v1/auth/register/guest
router.post('/register/guest', authRateLimiter, validate(GuestRegisterSchema), authController.registerGuest);

// POST /api/v1/auth/verify-email
router.post('/verify-email', authController.verifyEmail);

// POST /api/v1/auth/send-otp — verify credentials + send 6-digit OTP (rate-limited)
router.post('/send-otp', authRateLimiter, authController.sendOtp);

// POST /api/v1/auth/verify-otp — verify OTP + issue JWT session
router.post('/verify-otp', authRateLimiter, authController.verifyOtp);

// POST /api/v1/auth/forgot-password — request reset link (rate-limited)
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);

// POST /api/v1/auth/reset-password — confirm reset with token + new password
router.post('/reset-password', authController.resetPassword);

// GET /api/v1/auth/seed-demo — creates a demo user in the database
router.get('/seed-demo', authController.seedDemo);

export default router;
