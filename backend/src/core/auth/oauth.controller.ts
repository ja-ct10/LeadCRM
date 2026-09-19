import type { Request, Response, NextFunction } from 'express';
import { OAuthGoogleSchema } from './auth.dto';
import { verifyGoogleIdentity } from './google-identity.service';
import { findOrCreateUserByOAuth } from './oauth.service';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './auth-session';

export async function oauthGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = OAuthGoogleSchema.parse(req.body);
    const identity = await verifyGoogleIdentity(idToken);
    const result = await findOrCreateUserByOAuth(identity, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
    // The NextAuth server bridge consumes token; browser session callbacks never expose it.
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}
