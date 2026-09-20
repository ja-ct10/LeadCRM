'use client';

import { invalidateApiPageCache } from '@/shared/cache/invalidate-api-page-cache';
import { environmentSnapshot, isEnvironmentPath, trackEnvironmentMutation } from './environment-transport';

// LeadCRM API Client
// Sends HttpOnly cookies (leadcrm_token) on every request via credentials: 'include'.
// The backend auth middleware reads the cookie directly — no Bearer token needed.

// In production cross-domain deployments, route through the Next.js API proxy
// to avoid third-party cookie blocking. The proxy forwards the leadcrm_token cookie server-side.
const IS_BROWSER = typeof window !== 'undefined';
const DIRECT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const USE_PROXY = IS_BROWSER;
const API_URL = USE_PROXY ? '/api/proxy' : DIRECT_API_URL;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const scoped = isEnvironmentPath(path);
  const snapshot = environmentSnapshot();
  if (scoped && snapshot.switching) throw new Error('Switching environment. Please wait.');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (scoped && snapshot.environment) headers['X-CRM-Environment'] = snapshot.environment;

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

  const pending = fetch(`${API_URL}${finalPath}`, {
    method,
    headers,
    credentials: 'include', // sends HttpOnly leadcrm_token cookie automatically
    signal,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const res = await (scoped && method !== 'GET' ? trackEnvironmentMutation(pending) : pending);
  if (scoped && snapshot.generation !== environmentSnapshot().generation) {
    throw new DOMException('Environment changed', 'AbortError');
  }

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
    const error = new Error(errorMessage) as Error & { code?: string; status?: number };
    if (typeof rawError === 'object' && rawError !== null && typeof (rawError as Record<string, unknown>).code === 'string') {
      error.code = (rawError as Record<string, unknown>).code as string;
    }
    error.status = res.status;
    throw error;
  }

  if (method !== 'GET') invalidateApiPageCache(path);
  const data = await res.json() as T;
  if (scoped && snapshot.generation !== environmentSnapshot().generation) throw new DOMException('Environment changed', 'AbortError');
  return data;
}

export const apiClient = {
  get:    <T>(path: string, config?: { params?: Record<string, unknown>; signal?: AbortSignal }) => request<T>('GET', path, undefined, config?.params, config?.signal),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body?: unknown)  => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
  /** Low-level method for DELETE requests that need a JSON body. */
  deleteWithBody: <T>(path: string, body: unknown) => request<T>('DELETE', path, body),
};
