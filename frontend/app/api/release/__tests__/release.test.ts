// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { GET, dynamic, revalidate } from '../route';

afterEach(() => vi.unstubAllEnvs());

it('reports runtime source identity without exposing environment secrets or caching', async () => {
  vi.stubEnv('SOURCE_COMMIT', 'a'.repeat(40));
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('COOLIFY_CONFIG_TOKEN', 'private');
  const response = await GET();
  expect(await response.json()).toEqual({ status: 'ok', commit: 'a'.repeat(40), env: 'production' });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(dynamic).toBe('force-dynamic');
  expect(revalidate).toBe(0);
  vi.stubEnv('SOURCE_COMMIT', 'b'.repeat(40));
  expect((await (await GET()).json()).commit).toBe('b'.repeat(40));
});

it('makes unavailable source metadata explicit', async () => {
  vi.stubEnv('SOURCE_COMMIT', undefined);
  expect((await (await GET()).json()).commit).toBe('unknown');
});
