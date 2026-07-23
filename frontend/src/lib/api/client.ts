'use client';

// LeadCRM API Client
// Thin fetch wrapper used by all service files.
// Sends credentials (HttpOnly cookies) on every request.
// Falls back gracefully when backend is unreachable.

import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  const session = await getSession();
  const token = (session as any)?.accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? 'API request failed');
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
