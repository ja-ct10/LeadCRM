import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['dist/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@leadcrm/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
