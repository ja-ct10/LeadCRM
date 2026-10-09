import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../api/middleware/auth.middleware';
import { workspaceReadyMiddleware } from '../../../api/middleware/tenant.middleware';
import { tenantContext } from '../../../core/tenant/tenant-context';
import prisma from '../../../config/database.config';
import { dashboardAccess } from './dashboard.service';
import { AppError } from '../../../shared/errors/app-error';

/** Same persisted-revision SSE mechanism as Inbox, through the same proxy.
 * Counters become visible only after commit and survive process/replica restarts.
 * Every connection revalidates the real session and current RBAC, including admins.
 */
export const dashboardEvents = (req: Request, res: Response, next: NextFunction) => observeEvents(req, res, next, true);
export const authorizationEvents = (req: Request, res: Response, next: NextFunction) => observeEvents(req, res, next, false);
async function observeEvents(req: Request, res: Response, next: NextFunction, reporting: boolean) {
  try {
    if (reporting) await dashboardAccess(req.user!);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    let busy = false, stopped = false, previous = '';
    const tenantId = req.user!.tenantId;
    const prefix = reporting ? 'dashboard' : 'authorization';
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const tick = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        await new Promise<void>((resolve, reject) => {
          void authMiddleware(req, res, error => error ? reject(error) : resolve());
        });
        if (reporting) await new Promise<void>((resolve, reject) => {
          void workspaceReadyMiddleware(req, res, error => error ? reject(error) : resolve());
        });
        if (req.user!.tenantId !== tenantId) throw new AppError('Workspace changed', 403);
        const revision = await tenantContext.run({ tenantId }, async () => {
          if (reporting) await dashboardAccess(req.user!);
          return prisma.dashboardRevision.findUnique({ where: { tenantId } });
        });
        const counters = { analytics: String(revision?.analytics ?? 0), leads: String(revision?.leads ?? 0),
          actions: String(revision?.actions ?? 0), access: String(revision?.access ?? 0) };
        const payload = reporting ? counters : { access: counters.access };
        const key = JSON.stringify(payload);
        if (key !== previous) { send(`${prefix}-change`, payload); previous = key; }
        send(`${prefix}-heartbeat`, {});
      } catch (error) {
        if (error instanceof AppError && [401,403].includes(error.statusCode)) {
          send(`${prefix}-access-changed`, {}); res.end();
        } else send(`${prefix}-unavailable`, {});
      } finally { busy = false; }
    };
    const timer = setInterval(() => void tick(), 3000);
    const expiry = setTimeout(() => res.end(), 45000);
    timer.unref(); expiry.unref();
    res.on('close', () => { stopped = true; clearInterval(timer); clearTimeout(expiry); });
    void tick();
  } catch (error) { next(error); }
}
