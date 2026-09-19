import { Router } from 'express';
import { ClientAdminRegisterSchema } from '../../core/auth/auth.dto';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { LoginSchema, ForgotPasswordSchema, ResetPasswordSchema } from '../../core/auth/auth.dto';
import * as authController from '../../core/auth/auth.controller';
import { ChangePasswordSchema, changePassword } from '../../core/auth/change-password.service';
const router = Router();
router.post('/invitations/accept', authRateLimiter, validate(ClientAdminRegisterSchema), authController.registerClientAdmin);
router.post('/login', authRateLimiter, validate(LoginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.me);
router.post('/forgot-password', passwordResetRateLimiter, validate(ForgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', passwordResetRateLimiter, validate(ResetPasswordSchema), authController.resetPassword);
router.post('/change-password', authRateLimiter, authMiddleware, validate(ChangePasswordSchema), async (req, res, next) => {
  try {
    await changePassword(req.user!, req.body);
    // All old sessions are revoked. A fresh sign-in establishes a new session.
    res.clearCookie('leadcrm_token', { path: '/' });
    res.json({ success: true });
  } catch (error) { next(error); }
});
router.get('/onboarding/status', authMiddleware, authController.getOnboardingStatus);
router.post('/onboarding/complete', authMiddleware, authController.completeOnboarding);
export default router;
