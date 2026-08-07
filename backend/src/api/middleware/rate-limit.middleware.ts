import rateLimit from 'express-rate-limit';

// In development, use very high limits to avoid blocking local testing
const isDev = process.env.NODE_ENV !== 'production';

// General API rate limit — 100 requests per minute per IP
export const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please try again later.' },
});

// Strict limit for credential-guessing surfaces
// In dev: effectively unlimited so local testing is never blocked
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts — try again in 15 minutes.' },
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts — try again in an hour.' },
});

// Extra-strict limit for password reset
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 10000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many password reset requests — try again in an hour.' },
});
