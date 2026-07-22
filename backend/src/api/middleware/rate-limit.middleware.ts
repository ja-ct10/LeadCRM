import rateLimit from 'express-rate-limit';

// General API rate limit — 100 requests per minute per IP
export const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please try again later.' },
});

// Strict limit for auth endpoints — 5 per 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts — try again in 15 minutes.' },
});
