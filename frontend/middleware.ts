import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — intentionally minimal.
 *
 * Auth protection is handled client-side by <AuthGuard> in each layout.
 * AuthContext supports both mock (localStorage) and real API (NextAuth)
 * modes via NEXT_PUBLIC_USE_MOCK_AUTH. Server-side token inspection would
 * only work in real-API mode, so we avoid it here to prevent redirect loops
 * when running in mock mode.
 *
 * The matcher below excludes static assets and Next.js internals so this
 * runs only on actual page navigations.
 */
export function middleware(_req: NextRequest): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, svg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
