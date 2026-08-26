# Proxy Cookie Forwarding Fix — Bugfix Design

## Overview

All API calls return HTTP 401 "Authentication required" in production because the Next.js API proxy route (`/api/proxy/[...path]`) strips `Set-Cookie` headers from backend responses. After login, the browser never receives the `leadcrm_token` HttpOnly cookie, so subsequent requests through the proxy carry no authentication token. Additionally, the backend sets `sameSite: 'none'` in production, which is incorrect for the same-origin proxy pattern and will be changed to `'lax'`.

The fix is minimal and targeted: forward `Set-Cookie` headers through the proxy response, and align the backend cookie configuration with the same-origin proxy architecture.

## Glossary

- **Bug_Condition (C)**: A backend response containing a `Set-Cookie` header is returned through the proxy route, and the proxy drops that header before forwarding the response to the browser.
- **Property (P)**: When a backend response includes `Set-Cookie` headers, the proxy MUST forward them to the browser so the cookie is stored and available for subsequent requests.
- **Preservation**: All existing proxy behavior (request forwarding, error handling, body pass-through, IP forwarding) must remain unchanged for requests that do not involve `Set-Cookie` response headers.
- **proxyRequest**: The function in `frontend/app/api/proxy/[...path]/route.ts` that forwards requests from browser to backend and returns the backend response.
- **COOKIE_OPTIONS**: The object in `backend/src/core/auth/auth.controller.ts` that configures `sameSite`, `secure`, `httpOnly`, and `maxAge` for the `leadcrm_token` cookie.
- **USE_PROXY**: The computed flag in `frontend/src/lib/api/client.ts` that determines whether browser requests route through `/api/proxy` (production cross-domain) or directly to the backend (local dev).

## Bug Details

### Bug Condition

The bug manifests when the proxy forwards a backend response that includes one or more `Set-Cookie` headers. The `proxyRequest` function only copies `Content-Type` from the backend response, discarding all other headers including `Set-Cookie`. Since the browser never stores the `leadcrm_token` cookie, every subsequent proxy request sends no authentication to the backend.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { backendResponse: Response, proxyUsed: boolean }
  OUTPUT: boolean
  
  RETURN input.proxyUsed = true
         AND input.backendResponse.headers.has('set-cookie')
         AND proxyResponse.headers NOT contains 'set-cookie'
END FUNCTION
```

### Examples

- **Login via proxy**: User POSTs credentials to `/api/proxy/auth/login`. Backend returns `Set-Cookie: leadcrm_token=eyJ...`. Proxy returns response with only `Content-Type` header. Browser stores no cookie. Next GET to `/api/proxy/crm/leads` → 401.
- **OAuth flow via proxy**: NextAuth callback POSTs to `/api/proxy/auth/oauth/google`. Backend returns `Set-Cookie: leadcrm_token=eyJ...`. Proxy drops it. User gets 401 on subsequent navigation.
- **Logout via proxy**: User POSTs to `/api/proxy/auth/logout`. Backend returns `Set-Cookie: leadcrm_token=; Max-Age=0`. Proxy drops it. Cookie is never cleared in the browser.
- **Verify email OTP**: User POSTs to `/api/proxy/auth/verify-otp`. Backend auto-logs in and returns `Set-Cookie`. Proxy drops it. User appears logged out immediately.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Direct API calls in local development (`USE_PROXY=false`) continue to use `credentials: 'include'` and receive cookies directly from backend responses.
- Proxy request forwarding: HTTP method, request body, query parameters, and `X-Forwarded-For` header are forwarded unchanged.
- Proxy error handling: Backend unreachable → 502 with `{ success: false, error: { message: 'Backend unreachable' } }`.
- Proxy status code forwarding: Non-200 backend responses pass through with their original status code and body.
- The `Content-Type` header continues to be forwarded on responses.

**Scope:**
All inputs where the backend response does NOT include a `Set-Cookie` header should be completely unaffected by this fix. This includes:
- GET requests for data (`/crm/leads`, `/crm/deals`, etc.)
- POST/PUT/PATCH requests that don't issue session cookies
- Error responses (4xx, 5xx) without `Set-Cookie`
- Backend unreachable (502) responses

## Hypothesized Root Cause

Based on the code inspection, the root causes are confirmed (not hypothesized):

1. **Proxy drops `Set-Cookie` response headers**: In `proxyRequest()`, the `NextResponse` constructor only copies `Content-Type`:
   ```typescript
   return new NextResponse(data, {
     status: backendRes.status,
     headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
   });
   ```
   The `set-cookie` header (and all other response headers) are discarded.

2. **Incorrect `sameSite` in production**: `COOKIE_OPTIONS` uses `sameSite: 'none'` in production. Since the proxy makes the flow same-origin (browser → `/api/proxy` on Vercel → backend on Render), the cookie path is same-origin from the browser's perspective. `sameSite: 'lax'` is both correct and more secure for this architecture. `'none'` requires `Secure` and is designed for cross-site requests, but here the browser only communicates with Vercel's origin.

3. **`Set-Cookie` header multiplicity**: The `set-cookie` header can appear multiple times in a response (one per cookie). The Fetch API's `Headers.get('set-cookie')` collapses them. The correct approach is to use `Headers.getSetCookie()` (available in Node 18+ / Next.js edge runtime) or iterate via `headers.entries()`.

## Correctness Properties

Property 1: Bug Condition - Set-Cookie Headers Forwarded Through Proxy

_For any_ backend response that includes one or more `Set-Cookie` headers when proxied through `/api/proxy/[...path]`, the proxy response returned to the browser SHALL include all `Set-Cookie` headers from the backend response with their values preserved (including `Path`, `Max-Age`, `HttpOnly`, `Secure`, `SameSite` directives).

**Validates: Requirements 2.1, 2.2, 2.5**

Property 2: Preservation - Non-Cookie Response Behavior Unchanged

_For any_ request through the proxy where the backend response does NOT include `Set-Cookie` headers, the proxy SHALL produce exactly the same response as the original implementation (same status code, same body, same `Content-Type` header), preserving all existing proxy functionality for data-only requests.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**

## Fix Implementation

### Changes Required

**File 1**: `frontend/app/api/proxy/[...path]/route.ts`

**Function**: `proxyRequest`

**Specific Changes**:
1. **Forward `Set-Cookie` headers from backend response**: After constructing the `NextResponse`, iterate over the backend response's `set-cookie` headers and append each one to the proxy response. Use `backendRes.headers.getSetCookie()` to correctly handle multiple `Set-Cookie` headers without collapsing them.

2. **Forward additional safe response headers**: In addition to `Content-Type`, forward `Cache-Control` and any other safe response headers from the backend.

3. **Rewrite cookie `Domain` if present**: If the backend's `Set-Cookie` includes a `Domain` directive pointing to the Render domain, it must be stripped or rewritten — the cookie needs to be set on the Vercel domain (the browser's origin). Since the backend currently does NOT set `Domain` in `COOKIE_OPTIONS`, this is a defensive measure only.

**Implementation sketch**:
```typescript
const response = new NextResponse(data, {
  status: backendRes.status,
  headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
});

// Forward Set-Cookie headers from backend to browser
const setCookies = backendRes.headers.getSetCookie();
for (const cookie of setCookies) {
  response.headers.append('Set-Cookie', cookie);
}

return response;
```

---

**File 2**: `backend/src/core/auth/auth.controller.ts`

**Constant**: `COOKIE_OPTIONS`

**Specific Changes**:
1. **Change `sameSite` from `'none'` to `'lax'` in production**: Since the proxy makes browser requests same-origin, `'lax'` is the correct and more secure setting. The `'none'` value was needed for direct cross-origin requests (browser → Render), but the proxy architecture eliminates that need.

2. **Keep `secure: true` in production**: Even with `sameSite: 'lax'`, the `Secure` flag ensures the cookie is only sent over HTTPS, which is correct for the Vercel production deployment.

**Before**:
```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};
```

**After**:
```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge:   7 * 24 * 60 * 60 * 1000,
};
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause by observing that `Set-Cookie` headers are missing from proxy responses.

**Test Plan**: Write integration tests that call the proxy route handler with mocked backend responses containing `Set-Cookie` headers. Assert that the proxy response includes those headers. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Login response test**: Mock backend response with `Set-Cookie: leadcrm_token=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`. Assert proxy response includes `Set-Cookie` header. (will fail on unfixed code)
2. **Logout response test**: Mock backend response with `Set-Cookie: leadcrm_token=; Max-Age=0; Path=/`. Assert proxy response includes the clearing cookie. (will fail on unfixed code)
3. **Multiple Set-Cookie test**: Mock backend response with two `Set-Cookie` headers. Assert both are forwarded. (will fail on unfixed code)
4. **No Set-Cookie test**: Mock backend response without any `Set-Cookie` header. Assert proxy response status and body are correct. (should pass on unfixed code — this is the preservation baseline)

**Expected Counterexamples**:
- Proxy response headers contain only `Content-Type`, missing `Set-Cookie` entirely
- Root cause confirmed: `NextResponse` constructor only receives `{ 'Content-Type': ... }` as headers

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (backend response includes `Set-Cookie`), the fixed proxy correctly forwards those headers to the browser.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := proxyRequest_fixed(input)
  ASSERT result.headers.getSetCookie() = input.backendResponse.headers.getSetCookie()
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (backend response has no `Set-Cookie`), the fixed proxy produces the same result as the original proxy.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT proxyRequest_original(input).status = proxyRequest_fixed(input).status
  ASSERT proxyRequest_original(input).body = proxyRequest_fixed(input).body
  ASSERT proxyRequest_original(input).headers['content-type'] = proxyRequest_fixed(input).headers['content-type']
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of HTTP methods, paths, status codes, and response bodies
- It catches edge cases where the fix might accidentally alter non-cookie responses
- It provides strong guarantees that data-only proxy behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for requests without `Set-Cookie` responses, then write property-based tests capturing that behavior.

**Test Cases**:
1. **GET data request preservation**: Verify GET requests to `/crm/leads` return same status, body, and content-type through proxy
2. **Error status preservation**: Verify 400/401/403/404/500 responses pass through unchanged
3. **502 backend-down preservation**: Verify unreachable backend returns same 502 JSON error
4. **Request forwarding preservation**: Verify HTTP method, body, query params, and X-Forwarded-For are sent to backend unchanged

### Unit Tests

- Test that proxy response includes all `Set-Cookie` headers from backend
- Test that multiple `Set-Cookie` headers are each forwarded (not collapsed)
- Test that `Content-Type` continues to be forwarded
- Test that status codes pass through unchanged
- Test that `sameSite: 'lax'` is set in `COOKIE_OPTIONS` regardless of `NODE_ENV`
- Test edge case: backend returns empty `Set-Cookie` value (should still forward)

### Property-Based Tests

- Generate random HTTP responses (with and without `Set-Cookie`) and verify the proxy correctly forwards cookies when present and preserves existing behavior when absent
- Generate random cookie strings and verify they are forwarded verbatim without modification
- Generate random status codes and response bodies to verify pass-through is unchanged

### Integration Tests

- Test full login flow through proxy: POST credentials → receive Set-Cookie → subsequent GET includes cookie → 200
- Test full logout flow through proxy: POST logout → receive clearing Set-Cookie → subsequent GET has no cookie → 401
- Test OAuth flow: POST to /auth/oauth/google → receive Set-Cookie → subsequent requests authenticated
- Test verify-email OTP flow: POST to /auth/verify-otp → receive Set-Cookie → auto-logged-in state works
