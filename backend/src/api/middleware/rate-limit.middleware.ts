import rateLimit from 'express-rate-limit';

// General API rate limit — 100 requests per minute per IP
export const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please try again later.' },
});

// Strict limit for credential-guessing surfaces — 10 per 15 min per IP.
// Applies to login, send-otp and verify-otp only. Successful requests are not
// counted, so a legitimate user who signs in first try is never throttled.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts — try again in 15 minutes.' },
});

// Registration is not a credential-guessing surface, so it gets its own
// budget — otherwise signing up would eat into the login allowance.
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts — try again in an hour.' },
});

// Extra-strict limit for password reset — 3 per hour
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many password reset requests — try again in an hour.' },
});
