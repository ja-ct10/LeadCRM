// Required for NextAuth v4 on Next.js 15 — prevents static optimisation
// which breaks cookie/header access during OAuth initiation.
export const dynamic = 'force-dynamic';

import NextAuth from 'next-auth';
import { authOptions } from './auth-options';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
