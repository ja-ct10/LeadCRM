import { Request, Response, NextFunction } from 'express';
// TODO: implement companies controller
// Pattern: getAll, getById, create, update, delete — same as contacts

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, hasMore: false } });
  } catch (err) { next(err); }
}
