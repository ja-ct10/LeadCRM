import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Request, Response, NextFunction } from 'express';

export const crmMaintenanceFile = join(tmpdir(), 'leadcrm-crm-retirement-maintenance.json');
const maximumWindow = 10 * 60 * 1000;
// These are passive database reads. Tracking links, providers and public form
// submissions deliberately remain unavailable while writers are drained.
const passivePath = /^(?:\/health|\/api\/v1\/(?:health|auth\/me|crm\/(?:leads|contacts|accounts|deals)(?:\/[^/]+)?(?:\/(?:activity|notes|related))?))\/?$/;

export function maintenanceDeadline(value: unknown, now = Date.now()): number {
  const deadline = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(deadline) || deadline <= now || deadline - now > maximumWindow) throw new Error('CRM_MAINTENANCE_INVALID_DEADLINE');
  return deadline;
}

export function createCrmRetirementMaintenance() {
  let deadline = 0;
  let drained = false;
  const requests = new Set<Response>();
  const waiters = new Set<() => void>();
  return {
    get active() { return deadline !== 0; },
    status() { return { deadline, drained, requests: requests.size }; },
    begin(until: number) {
      if (deadline && deadline !== until) throw new Error('CRM_MAINTENANCE_ALREADY_ACTIVE');
      deadline = until;
      drained = false;
      for (const response of requests) if (String(response.getHeader('content-type')).includes('text/event-stream')) response.end();
    },
    async drain() {
      if (requests.size) await new Promise<void>(done => waiters.add(done));
      drained = true;
    },
    resume() { deadline = 0; drained = false; },
    middleware(req: Request, res: Response, next: NextFunction) {
      if (deadline) {
        if (!['GET', 'HEAD'].includes(req.method) || !passivePath.test(req.path)) {
          res.setHeader('Retry-After', '30');
          res.status(503).json({ success: false, error: { code: 'CRM_MAINTENANCE', message: 'CRM maintenance is in progress. Please retry shortly.' } });
          return;
        }
        req.headers['x-leadcrm-passive'] = '1';
      } else {
        requests.add(res);
        const finish = () => {
          requests.delete(res);
          if (!requests.size) { for (const done of waiters) done(); waiters.clear(); }
        };
        res.once('finish', finish);
        res.once('close', finish);
      }
      next();
    },
  };
}

export const crmRetirementMaintenance = createCrmRetirementMaintenance();

/** Private container control, never an HTTP endpoint. SIGUSR2 reads the protected
 * operator file; the status file is emitted only after actual request/job drain. */
export function installCrmRetirementMaintenance(options: {
  start: () => void;
  stop: () => Promise<void>;
  runtimeReadOnly: () => Promise<boolean>;
}) {
  const commit = process.env.SOURCE_COMMIT;
  let timer: NodeJS.Timeout | undefined;
  let stopping = false;
  let transition: Promise<void> = Promise.resolve();
  const receipt = () => writeFileSync(crmMaintenanceFile + '.status', JSON.stringify({ commit, pid: process.pid, ...crmRetirementMaintenance.status() }), { mode: 0o600 });
  const recover = async () => {
    if (stopping || !crmRetirementMaintenance.active) return;
    // The independent PostgreSQL watchdog restores the original role settings
    // first. Never restart writers while the database fence is still in force.
    if (await options.runtimeReadOnly()) throw new Error('APPLICATION_WRITES_STILL_PAUSED');
    crmRetirementMaintenance.resume();
    options.start();
    receipt();
    console.log('[crm-maintenance] Normal operation restored');
  };
  const scheduleRecovery = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      transition = transition.then(recover).catch(error => {
        console.error('[crm-maintenance] Recovery waiting:', error.code || error.message);
        if (!stopping && crmRetirementMaintenance.active) { timer = setTimeout(scheduleRecovery, 1000); timer.unref(); }
      });
    }, Math.max(1, crmRetirementMaintenance.status().deadline - Date.now()));
    timer.unref();
  };
  const command = () => {
    const value = JSON.parse(readFileSync(crmMaintenanceFile, 'utf8'));
    if (!commit || value.commit !== commit) throw new Error('CRM_MAINTENANCE_RELEASE_MISMATCH');
    return value;
  };
  const pause = async (until: number) => {
    crmRetirementMaintenance.begin(until);
    await options.stop();
    await crmRetirementMaintenance.drain();
    receipt();
    scheduleRecovery();
    console.log('[crm-maintenance] Requests and background writers drained');
  };
  // Recreated/restarted containers can opt into maintenance at startup too.
  const startup = process.env.CRM_RETIREMENT_MAINTENANCE_UNTIL;
  if (startup && Date.parse(startup) > Date.now()) crmRetirementMaintenance.begin(maintenanceDeadline(startup));
  else if (startup && !Number.isFinite(Date.parse(startup))) throw new Error('CRM_MAINTENANCE_INVALID_DEADLINE');
  if (existsSync(crmMaintenanceFile)) {
    const saved = JSON.parse(readFileSync(crmMaintenanceFile, 'utf8'));
    if (saved.action === 'pause' && Date.parse(saved.deadline) > Date.now()) {
      const value = command();
      crmRetirementMaintenance.begin(maintenanceDeadline(value.deadline));
    }
  }
  process.on('SIGUSR2', () => {
    transition = transition.then(async () => {
      const value = command();
      if (value.action === 'pause') await pause(maintenanceDeadline(value.deadline));
      else if (value.action === 'resume') { await recover(); clearTimeout(timer); }
      else throw new Error('CRM_MAINTENANCE_INVALID_ACTION');
    }).catch(error => console.error('[crm-maintenance]', error.code || error.message));
  });
  return {
    async start() {
      if (crmRetirementMaintenance.active) { await crmRetirementMaintenance.drain(); receipt(); scheduleRecovery(); }
      else options.start();
    },
    async stop() { stopping = true; clearTimeout(timer); await transition; await options.stop(); },
  };
}
