import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow importing .ts extensions in source (same as before)
  experimental: {},
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
    APP_URL: process.env.APP_URL ?? '',
  },
};

export default nextConfig;
