'use client';

// LeadCRM API Client
// Sends HttpOnly cookies (leadcrm_token) on every request via credentials: 'include'.
// The backend auth middleware reads the cookie directly — no Bearer token needed.

// In production cross-domain deployments, route through the Next.js API proxy
// to avoid third-party cookie blocking. The proxy forwards the leadcrm_token cookie server-side.
const IS_BROWSER = typeof window !== 'undefined';
const DIRECT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const USE_PROXY = IS_BROWSER && DIRECT_API_URL.startsWith('https://') && !DIRECT_API_URL.includes('localhost');
const API_URL = USE_PROXY ? '/api/proxy' : DIRECT_API_URL;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let finalPath = path;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      finalPath += `?${qs}`;
    }
  }

  const res = await fetch(`${API_URL}${finalPath}`, {
    method,
    headers,
    credentials: 'include', // sends HttpOnly leadcrm_token cookie automatically
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    // Backend can return error as a string (AppError path) or as an object
    // with { code, message } (validation error path). Extract message from both.
    const rawError = errorData.error;
    const errorMessage =
      (typeof rawError === 'string' && rawError)
        ? rawError
        : (typeof rawError === 'object' && rawError !== null && typeof (rawError as Record<string, unknown>).message === 'string')
          ? (rawError as Record<string, unknown>).message as string
          : (typeof errorData.message === 'string' && errorData.message)
            ? errorData.message
            : res.statusText || 'API request failed';
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get:    <T>(path: string, config?: { params?: Record<string, unknown> }) => request<T>('GET',    path, undefined, config?.params),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body?: unknown)  => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};
