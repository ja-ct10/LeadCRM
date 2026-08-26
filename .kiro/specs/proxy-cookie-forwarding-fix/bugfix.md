# Bugfix Requirements Document

## Introduction

All API calls return HTTP 401 "Authentication required" after a successful login in production (Vercel + Render deployment). The root cause is that the Next.js API proxy route (`/api/proxy/[...path]`) drops `Set-Cookie` headers from backend responses, preventing the browser from ever storing the `leadcrm_token` HttpOnly cookie. Since subsequent proxy requests read the cookie from the browser to forward it to the backend, authentication fails on every request after login. This is a CRITICAL severity bug — no user can access any data in production.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the proxy forwards a backend response that includes a `Set-Cookie` header (e.g., after login) THEN the system drops the `Set-Cookie` header and only forwards `Content-Type`, so the browser never receives or stores the `leadcrm_token` cookie.

1.2 WHEN a subsequent API request is made through the proxy after login THEN the system cannot find the `leadcrm_token` cookie on the browser request (because it was never set), sends no authentication token to the backend, and the backend returns 401 "Authentication required".

1.3 WHEN the proxy forwards a request to the backend THEN the system only forwards the `Content-Type` and `Cookie` request headers, dropping other potentially relevant headers (e.g., `Accept`, `User-Agent`) and only returns `Content-Type` from the backend response, dropping all other response headers.

1.4 WHEN the backend sets `sameSite: 'none'` on the `leadcrm_token` cookie in production THEN the cookie configuration is mismatched for the proxy pattern — since requests from the browser go to the same-origin `/api/proxy` path, `sameSite: 'lax'` is the correct setting for the proxied flow.

### Expected Behavior (Correct)

2.1 WHEN the proxy forwards a backend response that includes a `Set-Cookie` header THEN the system SHALL forward the `Set-Cookie` header(s) to the browser so the cookie is properly stored.

2.2 WHEN a subsequent API request is made through the proxy after login THEN the system SHALL read the stored `leadcrm_token` cookie from the incoming browser request and forward it to the backend, resulting in successful authentication.

2.3 WHEN the proxy forwards responses from the backend THEN the system SHALL forward all safe response headers (at minimum `Set-Cookie`, `Content-Type`, `Cache-Control`) rather than only `Content-Type`.

2.4 WHEN the `leadcrm_token` cookie is set via the proxy (same-origin flow) THEN the cookie SHALL use `sameSite: 'lax'` since the browser-to-proxy request is same-origin and does not require cross-site cookie sending.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the proxy is not used (local development with `USE_PROXY=false`) THEN the system SHALL CONTINUE TO send requests directly to the backend with `credentials: 'include'` and receive cookies via the direct response.

3.2 WHEN a request is made through the proxy for a non-auth endpoint (e.g., `/crm/leads`) THEN the system SHALL CONTINUE TO forward the request body, query parameters, and HTTP method correctly to the backend.

3.3 WHEN the backend returns a non-200 status code through the proxy THEN the system SHALL CONTINUE TO forward the error status code and response body to the browser unchanged.

3.4 WHEN the backend is unreachable THEN the proxy SHALL CONTINUE TO return a 502 error with `{ success: false, error: { message: 'Backend unreachable' } }`.

3.5 WHEN a user logs out THEN the system SHALL CONTINUE TO clear the `leadcrm_token` cookie (the logout response's `Set-Cookie` with expired value must also be forwarded by the proxy).

3.6 WHEN the proxy forwards the client IP address via `X-Forwarded-For` for rate limiting THEN the system SHALL CONTINUE TO include the real client IP in the forwarded request headers.
