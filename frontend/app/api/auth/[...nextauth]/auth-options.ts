import { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const NEXTAUTH_SECRET      = process.env.NEXTAUTH_SECRET      ?? '';
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';

// Internal shape used only within this module
interface LeadCRMUser {
  id:                        string;
  email:                     string;
  name?:                     string | null;
  image?:                    string | null;
  firstName:                 string;
  lastName:                  string;
  role:                      string;
  tenantId:                  string;
  accessToken:               string;
  requiresProfileCompletion: boolean;
  callbackUrl?:              string;
}

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId:     GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: 'offline',
          prompt:      'select_account',
          scope:       'openid email profile',
        },
      },
    }),

    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              email:    credentials.email,
              password: credentials.password,
            }),
          });

          const result = await response.json() as {
            success: boolean;
            data?: {
              user: {
                id: string; email: string; firstName: string;
                lastName: string; role: string; tenantId: string;
              };
              token: string;
            };
          };

          if (response.ok && result.success && result.data?.user) {
            const lcUser: LeadCRMUser = {
              id:                        result.data.user.id,
              email:                     result.data.user.email,
              firstName:                 result.data.user.firstName,
              lastName:                  result.data.user.lastName,
              role:                      result.data.user.role,
              tenantId:                  result.data.user.tenantId,
              accessToken:               result.data.token,
              requiresProfileCompletion: false,
            };
            return lcUser as unknown as import('next-auth').User;
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          const idToken = account.id_token;
          if (!idToken) {
            console.error('[NextAuth] Google signIn: missing id_token');
            return false;
          }

          if (process.env.NODE_ENV === 'development') {
            console.info('[NextAuth] Google account keys:', Object.keys(account));
            console.info('[NextAuth] providerAccountId:', account.providerAccountId);
            console.info('[NextAuth] user.email:', user.email);
            console.info('[NextAuth] id_token present:', !!idToken);
          }

          const googleProfile = profile as {
            given_name?: string;
            family_name?: string;
            email_verified?: boolean;
          };

          if (process.env.NODE_ENV === 'development') {
            console.info('[NextAuth] Calling OAuth bridge:', `${API_URL}/auth/oauth/google`);
          }

          const response = await fetch(`${API_URL}/auth/oauth/google`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerAccountId: account.providerAccountId ?? (account as Record<string, unknown>).id ?? '',
              idToken,
              accessToken:    account.access_token,
              refreshToken:   account.refresh_token,
              expiresAtEpoch: account.expires_at,
              scope:          account.scope,
              email:          user.email ?? '',
              firstName:      googleProfile.given_name  ?? user.name?.split(' ')[0] ?? '',
              lastName:       googleProfile.family_name ?? (user.name?.split(' ').slice(1).join(' ') || 'User'),
              avatarUrl:      user.image ?? undefined,
              emailVerified:  googleProfile.email_verified ?? false,
            }),
          });

          const result = await response.json() as {
            success: boolean;
            data?: {
              user: {
                id: string; email: string; firstName: string;
                lastName: string; role: string; tenantId: string; avatarUrl: string | null;
              };
              token: string;
              isNewUser: boolean;
              requiresProfileCompletion: boolean;
            };
            error?: string;
          };

          if (!response.ok || !result.success || !result.data) {
            console.error('[NextAuth] OAuth bridge failed — status:', response.status, '| error:', result.error);
            return false;
          }

          const lcUser = user as unknown as LeadCRMUser;
          lcUser.id                        = result.data.user.id;
          lcUser.email                     = result.data.user.email;
          lcUser.firstName                 = result.data.user.firstName;
          lcUser.lastName                  = result.data.user.lastName;
          lcUser.role                      = result.data.user.role;
          lcUser.tenantId                  = result.data.user.tenantId;
          lcUser.accessToken               = result.data.token;
          lcUser.requiresProfileCompletion = result.data.requiresProfileCompletion;

          const cookieStore = await cookies();
          cookieStore.set('leadcrm_token', result.data.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
          });

          // Do NOT override callbackUrl here.
          // loginWithGoogle() sets callbackUrl: '/' so app/page.tsx handles
          // the post-login routing (onboarding gate, role-based default, etc.).
          // Setting callbackUrl on the user object here would bypass that gate.

          return true;
        } catch (err) {
          console.error('[NextAuth] OAuth signIn exception:', err instanceof Error ? err.message : err);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      // Handle session.update() calls — e.g. after company profile is completed,
      // we clear requiresProfileCompletion to prevent the onboarding gate loop.
      if (trigger === 'update' && session?.requiresProfileCompletion === false) {
        token.requiresProfileCompletion = false;
      }

      if (user) {
        const lcUser = user as unknown as LeadCRMUser;
        token.id                        = lcUser.id;
        token.role                      = lcUser.role;
        token.firstName                 = lcUser.firstName;
        token.lastName                  = lcUser.lastName;
        token.tenantId                  = lcUser.tenantId;
        token.accessToken               = lcUser.accessToken;
        token.requiresProfileCompletion = lcUser.requiresProfileCompletion ?? false;
        if (lcUser.callbackUrl) token.callbackUrl = lcUser.callbackUrl;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id        = token.id        as string;
      session.user.role      = token.role      as string;
      session.user.firstName = token.firstName as string;
      session.user.lastName  = token.lastName  as string;
      (session.user as unknown as { tenantId: string }).tenantId = token.tenantId as string;
      session.accessToken    = token.accessToken               as string;
      session.requiresProfileCompletion = token.requiresProfileCompletion as boolean ?? false;
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
    // newUser intentionally omitted — routing handled by AuthGuard
    // via requiresProfileCompletion flag (→ /onboarding → /company-setup)
  },

  session: {
    strategy: 'jwt',
    maxAge:   7 * 24 * 60 * 60,
  },

  debug: process.env.NODE_ENV === 'development',
};
