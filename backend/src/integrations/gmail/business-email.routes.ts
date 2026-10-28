import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authMiddleware } from '../../api/middleware/auth.middleware';
import { workspaceReadyMiddleware } from '../../api/middleware/tenant.middleware';
import { authorize } from '../../api/middleware/rbac.middleware';
import { AppError } from '../../shared/errors/app-error';
import { beginBusinessEmail, finishBusinessEmail, requireBusinessEmailAdmin, businessEmailStatus, syncBusinessEmail, listBusinessInquiries, reviewBusinessInquiry, disconnectBusinessEmail } from './business-email.service';

export const businessEmailRouter = Router();
businessEmailRouter.get('/callback', async (req, res) => {
  const destination = new URL('/inbox/business-email', process.env.APP_URL ?? 'http://localhost:3000');
  try {
    if (req.query.error) throw new AppError('Google connection cancelled or denied.', 400);
    const query = z.object({ state: z.string().min(20).max(200), code: z.string().min(1).max(4000) }).parse(req.query);
    await finishBusinessEmail(query.state, query.code);
    destination.searchParams.set('connected', 'true');
  } catch (error) { destination.searchParams.set('connection_error', error instanceof AppError ? error.message : 'Business mailbox connection failed. Please retry.'); }
  res.setHeader('Referrer-Policy', 'no-referrer'); res.redirect(destination.toString());
});
businessEmailRouter.use(authMiddleware, workspaceReadyMiddleware, async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try { await requireBusinessEmailAdmin(req.user!.tenantId, req.user!.userId); next(); } catch (error) { next(error); }
});
const limit = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false });
businessEmailRouter.get('/status', async (req, res, next) => { try { res.json(await businessEmailStatus(req.user!.tenantId)); } catch (e) { next(e); } });
businessEmailRouter.post('/authorize', limit, async (req, res, next) => {
  try {
    const token = req.cookies?.leadcrm_token ?? req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new AppError('Authentication required.', 401);
    res.json(await beginBusinessEmail(req.user!.tenantId, req.user!.userId, token));
  } catch (e) { next(e); }
});
businessEmailRouter.post('/disconnect', limit, async (req, res, next) => { try { await disconnectBusinessEmail(req.user!.tenantId, req.user!.userId); res.json({ success: true }); } catch (e) { next(e); } });
businessEmailRouter.post('/sync', limit, async (req, res, next) => { try { res.json(await syncBusinessEmail(req.user!.tenantId)); } catch (e) { next(e); } });
businessEmailRouter.get('/inquiries', async (req, res, next) => { try { res.json({ data: await listBusinessInquiries(req.user!.tenantId, z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page)) }); } catch (e) { next(e); } });
businessEmailRouter.post('/inquiries/:id/review', authorize('leads.create'), limit, async (req, res, next) => {
  try { res.json(await reviewBusinessInquiry(req.user!.tenantId, req.user!.userId, z.string().uuid().parse(req.params.id), req.body)); } catch (e) { next(e); }
});
