import { Request, Response, NextFunction } from 'express';
import { authorizedMailbox } from './mailbox-store';
import { tenantContext } from '../../core/tenant/tenant-context';
import { validateSession } from '../../core/auth/session.service';
import { AppError } from '../../shared/errors/app-error';

// One persisted-state observer per account per process, shared by all its tabs.
// Database revisions also deliver updates across backend replicas.
const observers = new Map<string, { clients: Map<Response, string>; stop: () => void }>();
export async function mailboxEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, userId } = req.user!;
    const sessionToken = req.cookies?.leadcrm_token ?? req.headers.authorization?.replace(/^Bearer /, '');
    if (!sessionToken) throw new AppError('Sign in again to receive mailbox updates.', 401);
    const { account, scope } = await authorizedMailbox(tenantId, userId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    let observer = observers.get(account.id);
    if (!observer) {
      const clients = new Map<Response, string>();
      let busy = false, revision = account.mailboxVersion, scopeRevision = scope.hash;
      const tick = async () => {
        if (busy) return;
        busy = true;
        try {
          // Each tab retains its own session, even though mailbox observation is shared.
          for (const [client, token] of clients) {
            try {
              const session = await tenantContext.run({ tenantId }, () => validateSession(token));
              if (session.tenantId !== tenantId || session.userId !== userId) throw new AppError('Mailbox session changed.', 401);
            } catch { client.write('event: mailbox-access-changed\ndata: {}\n\n'); client.end(); clients.delete(client); }
          }
          if (!clients.size) return;
          const current = await tenantContext.run({ tenantId }, () => authorizedMailbox(tenantId, userId));
          const accessChanged = current.scope.hash !== scopeRevision;
          if (accessChanged || current.account.mailboxVersion !== revision) {
            revision = current.account.mailboxVersion; scopeRevision = current.scope.hash;
            for (const client of clients.keys()) client.write(`event: ${accessChanged ? 'mailbox-access-changed' : 'mailbox-change'}\ndata: ${JSON.stringify({ version: revision, scopeRevision })}\n\n`);
          } else for (const client of clients.keys()) client.write(': heartbeat\n\n');
        } catch {
          for (const client of clients.keys()) { client.write('event: mailbox-access-changed\ndata: {}\n\n'); client.end(); }
        } finally { busy = false; }
      };
      const timer = setInterval(() => void tick(), 5000);
      timer.unref();
      observer = { clients, stop: () => clearInterval(timer) };
      observers.set(account.id, observer);
    }
    observer.clients.set(res, sessionToken);
    // Bound connection lifetime and reauthenticate the actual session on reconnect.
    const expiry = setTimeout(() => res.end(), 45000);
    const cleanup = () => {
      clearTimeout(expiry);
      observer!.clients.delete(res);
      if (!observer!.clients.size) { observer!.stop(); observers.delete(account.id); }
    };
    res.on('close', cleanup);
  } catch (error) { next(error); }
}
