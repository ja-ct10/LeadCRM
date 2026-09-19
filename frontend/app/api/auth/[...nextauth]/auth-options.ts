import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: { params: { prompt: 'select_account', scope: 'openid email profile' } },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !account.id_token) return false;
      try {
        const response = await fetch(`${API_URL}/auth/oauth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: account.id_token }),
          cache: 'no-store',
          signal: AbortSignal.timeout(25000),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          const errors: Record<string, string> = {
            EMAIL_VERIFICATION_REQUIRED: 'VerificationRequired',
            ACCOUNT_LINK_REQUIRED: 'OAuthAccountNotLinked',
            ACCOUNT_INACTIVE: 'AccountInactive',
          };
          const error = errors[result.error?.code];
          return error ? `/login?error=${error}` : false;
        }
        if (!result.data?.token || !result.data?.user?.id) return false;
        user.id = result.data.user.id;
        const cookieStore = await cookies();
        cookieStore.set('leadcrm_token', result.data.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });
        return true;
      } catch {
        console.error('[NextAuth] Google session handoff failed.');
        return false;
      }
    },
    async jwt({ token, user }) {
      // Explicitly discard legacy role, accessToken and onboarding flags.
      return {
        sub: user?.id ?? token.sub,
        name: user?.name ?? token.name,
        email: user?.email ?? token.email,
        picture: user?.image ?? token.picture,
      };
    },
    async redirect({ baseUrl }) {
      // /auth/me and the common frontend guard resolve every account's next step.
      return baseUrl;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
};
