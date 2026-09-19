import { AppError } from '../../shared/errors/app-error';
import { authTransaction } from './auth-transaction';
import { provisionWorkspace } from './provision-workspace.service';
import { issueAuthSession, type SessionContext } from './auth-session';
import type { GoogleIdentity } from './google-identity.service';

/** Identity comes exclusively from Google's verified ID-token claims. */
export async function findOrCreateUserByOAuth(
  profile: GoogleIdentity,
  ctx: SessionContext = {},
) {
  const result = await authTransaction(async tx => {
    const linked = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (linked) {
      assertActive(linked.user);
      return { user: linked.user, isNewUser: false };
    }
    const matches = await tx.user.findMany({
      where: { email: { equals: profile.email, mode: 'insensitive' } },
      take: 2,
    });
    if (matches.length > 1) {
      throw new AppError('Multiple accounts use this email. Sign in with your password.', 409, 'ACCOUNT_LINK_REQUIRED');
    }
    let user = matches[0];
    const isNewUser = !user;
    if (user) {
      assertActive(user);
      if (!profile.authoritativeEmail) {
        throw new AppError('Use your existing password to sign in to this account.', 409, 'ACCOUNT_LINK_REQUIRED');
      }
    } else {
      user = await provisionWorkspace(tx, {
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        passwordHash: null,
        emailVerified: new Date(),
      });
    }
    await tx.oAuthAccount.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    });
    return { user, isNewUser };
  });
  return { ...await issueAuthSession(result.user, ctx), isNewUser: result.isNewUser };
}

function assertActive(user: { status: string; emailVerified: Date | null }) {
  if (user.status === 'PENDING') {
    throw new AppError('Verify your registration email before using Google sign-in.', 403, 'EMAIL_VERIFICATION_REQUIRED');
  }
  if (user.status !== 'ACTIVE' || !user.emailVerified) {
    throw new AppError('Account is inactive. Contact your administrator.', 403, 'ACCOUNT_INACTIVE');
  }
}
