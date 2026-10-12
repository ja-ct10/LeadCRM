import { isIP } from 'node:net';
import type { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { loginIpKey } from '../../core/auth/login-attempt.service';

export const LOGIN_IP_LIMIT = 60;

/** Collapse equivalent forms and IPv6 /64s, so address rotation cannot evade a budget. */
export function loginIpIdentity(address: string): string {
  if (isIP(address) !== 6) return address;
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const parts = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill('0'), ...b];
  if (parts.slice(0, 5).every(part => parseInt(part, 16) === 0) && parseInt(parts[5], 16) === 0xffff) {
    const value = parseInt(parts[6], 16) * 65536 + parseInt(parts[7], 16);
    return [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
  }
  return `${parts.slice(0, 4).map(part => parseInt(part, 16).toString(16)).join(':')}::/64`;
}

/** Shared short IP budget, independent of the five-failure account threshold. */
export async function loginIpRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // req.ip is resolved by Express's configured trusted proxy chain. Never
    // select the first X-Forwarded-For or accept X-Real-IP directly here.
    const identityKey = loginIpKey(loginIpIdentity(req.ip || req.socket.remoteAddress || 'unknown'));
    const [row] = await prisma.$queryRaw<{ requests: number; windowEndsAt: Date; now: Date }[]>`
      INSERT INTO "LoginIpRateLimit" ("identityKey", "requests", "windowEndsAt", "updatedAt")
      VALUES (${identityKey}, 1, (clock_timestamp() AT TIME ZONE 'UTC') + INTERVAL '1 minute', clock_timestamp() AT TIME ZONE 'UTC')
      ON CONFLICT ("identityKey") DO UPDATE SET
        "requests" = CASE WHEN "LoginIpRateLimit"."windowEndsAt" <= (clock_timestamp() AT TIME ZONE 'UTC') THEN 1 ELSE LEAST("LoginIpRateLimit"."requests" + 1, 61) END,
        "windowEndsAt" = CASE WHEN "LoginIpRateLimit"."windowEndsAt" <= (clock_timestamp() AT TIME ZONE 'UTC') THEN (clock_timestamp() AT TIME ZONE 'UTC') + INTERVAL '1 minute' ELSE "LoginIpRateLimit"."windowEndsAt" END,
        "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
      RETURNING "requests", "windowEndsAt", clock_timestamp() AS "now"`;
    if (row.requests > LOGIN_IP_LIMIT) {
      next(new AppError('Too many sign-in requests. Please try again shortly.', 429, 'AUTH_LOGIN_RATE_LIMITED', row.windowEndsAt.toISOString(), row.now.toISOString()));
      return;
    }
    next();
  } catch (error) { next(error); } // Store failures fail closed, never bypass the budget.
}
