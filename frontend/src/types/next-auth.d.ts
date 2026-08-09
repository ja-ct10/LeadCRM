import 'next-auth';
import 'next-auth/jwt';

/**
 * Extends NextAuth's built-in types with LeadCRM-specific fields.
 * These are populated in the jwt() and session() callbacks in
 * app/api/auth/[...nextauth]/route.ts.
 */

declare module 'next-auth' {
  interface Session {
    /** LeadCRM backend JWT — used by AuthContext to bridge to the custom cookie session */
    accessToken: string;
    /** True when a new Google user still needs to fill in company details */
    requiresProfileCompletion: boolean;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      tenantId: string;
    };
  }

  interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    /** The LeadCRM backend JWT — transferred from signIn → jwt callback */
    accessToken?: string;
    requiresProfileCompletion?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    tenantId: string;
    accessToken: string;
    requiresProfileCompletion: boolean;
  }
}
