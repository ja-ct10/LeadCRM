import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@/features/tenant': path.resolve(__dirname, './src/features/tenant'),
      '@/features/system-admin': path.resolve(__dirname, './src/features/system-admin'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@leadcrm/shared': path.resolve(__dirname, '../shared/src'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
