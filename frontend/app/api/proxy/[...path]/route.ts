export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function proxyRequest(req: NextRequest, params: { path: string[] }): Promise<NextResponse> {
  const path = '/' + params.path.join('/');
  const url = BACKEND_URL + path + req.nextUrl.search;
  const token = req.cookies.get('leadcrm_token')?.value;
  const headers: Record<string, string> = {
    'Content-Type': req.headers.get('content-type') ?? 'application/json',
  };
  if (token) {
    headers['Cookie'] = 'leadcrm_token=' + token;
  }
  // Forward real client IP for rate limiting
  const clientIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  headers['X-Forwarded-For'] = clientIp;
  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;
  try {
    const backendRes = await fetch(url, { method: req.method, headers, body });
    const data = await backendRes.text();
    return new NextResponse(data, {
      status: backendRes.status,
      headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    console.error('[Proxy] Backend fetch failed:', err);
    return NextResponse.json({ success: false, error: { message: 'Backend unreachable' } }, { status: 502 });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyRequest(req, params);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyRequest(req, params);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyRequest(req, params);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyRequest(req, params);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return proxyRequest(req, params);
}
