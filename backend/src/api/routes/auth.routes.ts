import { Router } from 'express';
import {
  authRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
} from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { Permission } from '../../shared/constants/permissions';
import { validate } from '../middleware/validate.middleware';
import {
  LoginSchema,
  ClientAdminRegisterSchema,
  GuestRegisterSchema,
  SendOtpSchema,
  VerifyOtpSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../../core/auth/auth.dto';
import * as authController from '../../core/auth/auth.controller';

const router = Router();

// POST /api/v1/auth/login — rate-limited, validated
router.post('/login', authRateLimiter, validate(LoginSchema), authController.login);

// POST /api/v1/auth/logout — revokes session + clears HttpOnly cookie
router.post('/logout', authController.logout);

// GET /api/v1/auth/me — returns current user from token (session-validated)
router.get('/me', authMiddleware, authController.me);

// POST /api/v1/auth/register/client-admin
router.post('/register/client-admin', registerRateLimiter, validate(ClientAdminRegisterSchema), authController.registerClientAdmin);

// POST /api/v1/auth/register/guest
router.post('/register/guest', registerRateLimiter, validate(GuestRegisterSchema), authController.registerGuest);

// POST /api/v1/auth/verify-email
router.post('/verify-email', authRateLimiter, authController.verifyEmail);

// POST /api/v1/auth/send-otp — verify credentials + send 6-digit OTP (rate-limited, validated)
router.post('/send-otp', authRateLimiter, validate(SendOtpSchema), authController.sendOtp);

// POST /api/v1/auth/verify-otp — verify OTP + issue JWT session (rate-limited, validated)
router.post('/verify-otp', authRateLimiter, validate(VerifyOtpSchema), authController.verifyOtp);

// POST /api/v1/auth/forgot-password — request reset link (strict rate-limited, validated)
router.post('/forgot-password', passwordResetRateLimiter, validate(ForgotPasswordSchema), authController.forgotPassword);

// POST /api/v1/auth/reset-password — confirm reset with token + new password (strict rate-limited, validated)
router.post('/reset-password', passwordResetRateLimiter, validate(ResetPasswordSchema), authController.resetPassword);

// POST /api/v1/auth/seed-demo — creates a demo tenant + user (System Admin only)
router.post('/seed-demo', authMiddleware, authorize(Permission.ADMIN_ACCESS), authController.seedDemo);

// POST /api/v1/auth/seed-admin — creates the system admin user (run once after deploy, requires env secret)
router.post('/seed-admin', authController.seedAdmin);

export default router;
