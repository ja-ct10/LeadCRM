import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  const backendUrl = process.env.API_URL || 'http://ul2i77dyydgvdcrc7zpppay2.201.18.217.88.sslip.io/api/v1';

  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    async headers() {
      return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
    },
    async rewrites() {
      return [
        {
          source: '/api/proxy/:path*',
          destination: `${backendUrl}/:path*`,
        },
      ];
    },
  };
}
