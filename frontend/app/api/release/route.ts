import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Public release identity only; SOURCE_COMMIT is supplied at Coolify runtime. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    commit: process.env.SOURCE_COMMIT ?? 'unknown',
    env: process.env.NODE_ENV ?? 'development',
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
