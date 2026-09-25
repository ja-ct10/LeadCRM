import type { Request, Response, NextFunction } from 'express';
import * as service from './mfa.service';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './auth-session';
export const MFA_COOKIE_NAME = 'leadcrm_mfa_challenge';
export const MFA_COOKIE_OPTIONS = { ...AUTH_COOKIE_OPTIONS, maxAge: 5 * 60_000 };
const sessionToken = (req: Request): string => req.cookies?.[AUTH_COOKIE_NAME] ?? req.headers.authorization?.replace(/^Bearer /, '') ?? '';
const endpoint = (work: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json({ success: true, data: await work(req) }); } catch (error) { next(error); }
};
export const status = endpoint(req => service.mfaStatus(req.user!));
export const setup = endpoint(req => service.setupMfa(req.user!, req.body));
export const enable = endpoint(req => service.enableMfa(req.user!, req.body, sessionToken(req)));
export const disable = endpoint(req => service.manageMfa(req.user!, req.body, sessionToken(req), true));
export const regenerate = endpoint(req => service.manageMfa(req.user!, req.body, sessionToken(req), false));
export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.verifyMfaLogin(req.cookies?.[MFA_COOKIE_NAME], req.body, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.setHeader('Cache-Control', 'no-store');
    res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
    const { maxAge: _, ...options } = MFA_COOKIE_OPTIONS;
    res.clearCookie(MFA_COOKIE_NAME, options);
    res.json({ success: true, data: { user: result.user } });
  } catch (error) { next(error); }
}
