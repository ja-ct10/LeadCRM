import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {},
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
    APP_URL: process.env.APP_URL ?? '',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  },
};

export default nextConfig;
