import { expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { apiRateLimitResponse } from '../rate-limit.middleware';
it.each(['/api/v1/webhooks/textbee', '/api/v1/webhooks/textbee/'])('keeps overload retryable for TextBee at %s', originalUrl => {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  apiRateLimitResponse({ originalUrl } as Request, response as unknown as Response);
  expect(response.status).toHaveBeenCalledWith(503);
});
it('preserves the normal API rate-limit response', () => {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  apiRateLimitResponse({ originalUrl: '/api/v1/marketing/campaigns' } as Request, response as unknown as Response);
  expect(response.status).toHaveBeenCalledWith(429);
});
