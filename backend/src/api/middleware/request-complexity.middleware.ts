import type { NextFunction, Request, Response } from 'express';

// Bound work before schema validation; byte limits still protect strings/files.
const MAX_COLLECTION_ITEMS = 10000;
const MAX_NODES = 50000;
const MAX_DEPTH = 32;

export function requestComplexityMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.body == null || Buffer.isBuffer(req.body)) { next(); return; }
  const pending: Array<{ value: unknown; depth: number }> = [{ value: req.body, depth: 0 }];
  let nodes = 0;
  const reject = () => { res.status(413).json({ success: false, error: { code: 'REQUEST_TOO_COMPLEX', message: 'Request structure is too large or deeply nested.' } }); };
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) { reject(); return; }
    if (value === null || typeof value !== 'object' || Buffer.isBuffer(value)) continue;
    const entries = Array.isArray(value) ? value : Object.values(value);
    if (entries.length > MAX_COLLECTION_ITEMS) { reject(); return; }
    for (const entry of entries) pending.push({ value: entry, depth: depth + 1 });
  }
  next();
}
