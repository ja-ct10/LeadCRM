import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function proxyRequest(req: NextRequest, params: { path: string[] }): Promise<NextResponse> {
  const path = '/' + params.path.join('/');
  const url = new URL(path + req.nextUrl.search, BACKEND_URL);
  const cookieStore = await cookies();
  const token = cookieStore.get('leadcrm_token')?.value;
  const headers: Record<string, string> = { 'Content-Type': req.headers.get('content-type') ?? 'application/json' };
  if (token) { headers['Cookie'] = 'leadcrm_token=' + token; }
  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;
  try {
    const backendRes = await fetch(url.toString(), { method: req.method, headers, body });
    const data = await backendRes.text();
    return new NextResponse(data, { status: backendRes.status, headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Backend unreachable' } }, { status: 502 });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxyRequest(req, await context.params); }
export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxyRequest(req, await context.params); }
export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxyRequest(req, await context.params); }
export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxyRequest(req, await context.params); }
export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxyRequest(req, await context.params); }
