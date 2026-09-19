// @vitest-environment node
import { expect, it } from 'vitest';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants';
import nextConfig from '../../next.config';

it('keeps dev artifacts separate while build and production start share the standard output', () => {
  expect(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir).toBe('.next-dev');
  expect(nextConfig(PHASE_PRODUCTION_BUILD).distDir).toBe('.next');
  expect(nextConfig(PHASE_PRODUCTION_SERVER).distDir).toBe('.next');
});
