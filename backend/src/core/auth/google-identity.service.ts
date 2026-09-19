import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../../shared/errors/app-error';

const google = new OAuth2Client();

export async function verifyGoogleIdentity(idToken: string) {
  const audience = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!audience) throw new AppError('Google sign-in is not configured.', 503);
  try {
    const ticket = await google.verifyIdToken({ idToken, audience });
    const claims = ticket.getPayload();
    if (!claims?.sub || !claims.email || !claims.email_verified) {
      throw new Error('Verified Google identity required');
    }
    const email = claims.email.trim().toLowerCase();
    return {
      providerAccountId: claims.sub,
      provider: 'google' as const,
      email,
      firstName: claims.given_name || claims.name || 'Google',
      lastName: claims.family_name || '',
      avatarUrl: claims.picture,
      // For third-party addresses Google may no longer control the mailbox.
      authoritativeEmail: email.endsWith('@gmail.com') || Boolean(claims.hd),
    };
  } catch {
    throw new AppError('Invalid or expired Google sign-in. Please try again.', 401);
  }
}

export type GoogleIdentity = Awaited<ReturnType<typeof verifyGoogleIdentity>>;
