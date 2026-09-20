import { AppError } from '../../shared/errors/app-error';
import type { SessionContext } from './auth-session';
import type { GoogleIdentity } from './google-identity.service';
import type { AuthUser } from '@leadcrm/shared';

/** Public OAuth provisioning is retired; use administrator-provisioned password login. */
export async function findOrCreateUserByOAuth(_profile: GoogleIdentity, _ctx: SessionContext = {}): Promise<{ token: string; user: AuthUser; isNewUser: boolean }> {
  throw new AppError('Use your administrator-provisioned account to sign in.', 403, 'SELF_SERVICE_DISABLED');
}
