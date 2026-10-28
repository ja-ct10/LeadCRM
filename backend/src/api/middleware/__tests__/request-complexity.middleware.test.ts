import { expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requestComplexityMiddleware } from '../request-complexity.middleware';

function check(body: unknown) {
  const req = { body } as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  requestComplexityMiddleware(req, res as unknown as Response, next);
  return { req, res, next };
}
it('rejects excessive collections before validation without echoing submitted data', () => {
  const { res, next } = check({ privateData: Array(10001).fill('private-customer@example.test') });
  expect(res.status).toHaveBeenCalledWith(413);
  expect(next).not.toHaveBeenCalled();
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('private-customer');
});
it('bounds both nesting and aggregate traversal work', () => {
  let nested: unknown = 'leaf'; for (let i = 0; i < 34; i++) nested = { next: nested };
  expect(check(nested).res.status).toHaveBeenCalledWith(413);
  expect(check(Array.from({ length: 10 }, () => Array(6000).fill(0))).res.status).toHaveBeenCalledWith(413);
});
it('leaves normal bulk IDs, CSV strings, and raw webhook bytes untouched', () => {
  for (const body of [{ ids: Array.from({ length: 1000 }, (_, i) => String(i)) }, { csv: 'x'.repeat(10 * 1024 * 1024) }, Buffer.from('signed webhook body'), undefined]) {
    const { req, next, res } = check(body);
    expect(req.body).toBe(body); expect(next).toHaveBeenCalledOnce(); expect(res.status).not.toHaveBeenCalled();
  }
});
