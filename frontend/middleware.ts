import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Protect system admin routes
    if (path.startsWith("/(system-admin)") || path.startsWith("/system")) {
      if (token?.role !== "System Admin") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }
    
    // Prevent authenticated users from accessing guest routes
    if (token && (path.startsWith("/login") || path.startsWith("/register"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Public paths that do not require auth
        if (
          path.startsWith("/login") ||
          path.startsWith("/register") ||
          path.startsWith("/api/auth") ||
          path === "/"
        ) {
          return true;
        }
        // Require auth for all other paths
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
