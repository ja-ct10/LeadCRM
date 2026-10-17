import { NextRequest, NextResponse } from 'next/server';
import { campaignLinkDestination, SMS_LINK_TOKEN_PATTERN } from '@leadcrm/shared';
import { getBackendUrl } from '@/lib/server/backend-url';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };

async function redirectSmsLink(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!SMS_LINK_TOKEN_PATTERN.test(token)) return new NextResponse('SMS link not found.', { status: 404, headers });
  try {
    // Never forward CRM cookies, authorization, query parameters, or follow the destination server-side.
    const upstream = await fetch(`${getBackendUrl()}/public/sms-links/${token}`, {
      method: req.method, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: {
        ...Object.fromEntries(['user-agent', 'purpose', 'sec-purpose'].map(name => [name, req.headers.get(name) ?? ''])),
        // Use the same ingress/IP chain as the existing API proxy. Backend trust
        // remains limited by TRUSTED_PROXIES; recipients must not share one budget.
        'X-Forwarded-For': req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1',
      },
    });
    const destination = upstream.headers.get('location');
    if (upstream.status === 302 && destination && campaignLinkDestination(destination)) return new NextResponse(null, { status: 302, headers: { ...headers, Location: destination } });
    return new NextResponse(upstream.status === 404 ? 'SMS link not found.' : 'Unable to open this SMS link. Please try again.', { status: upstream.status === 404 ? 404 : 503, headers });
  } catch { return new NextResponse('Unable to open this SMS link. Please try again.', { status: 503, headers }); }
}

export const GET = redirectSmsLink;
export const HEAD = redirectSmsLink;
