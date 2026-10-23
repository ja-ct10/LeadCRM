import { afterEach, expect, it, vi } from 'vitest';
const files = vi.hoisted(() => ({ value:'', receipts:[] as Array<{drained:boolean;deadline:number}> }));
vi.mock('node:fs', () => ({
  existsSync: () => false,
  readFileSync: () => files.value,
  writeFileSync: (_path: string, value: string) => { files.receipts.push(JSON.parse(value)); },
}));
import { crmRetirementMaintenance, installCrmRetirementMaintenance } from './crm-retirement-maintenance';
const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
afterEach(() => { crmRetirementMaintenance.resume(); files.receipts=[]; vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });
function control(readonly = false) {
  vi.stubEnv('SOURCE_COMMIT','a'.repeat(40));
  vi.stubEnv('CRM_RETIREMENT_MAINTENANCE_UNTIL','');
  let signal = () => {};
  vi.spyOn(process,'on').mockImplementation((_name, listener) => { signal = listener as () => void; return process; });
  const options = { start:vi.fn(), stop:vi.fn(async () => {}), runtimeReadOnly:vi.fn(async () => readonly) };
  const installed = installCrmRetirementMaintenance(options);
  return { installed, options, signal: (action: string, deadline: string) => { files.value=JSON.stringify({action,deadline,commit:'a'.repeat(40)}); signal(); } };
}
it('attests only real drain and refuses an early resume while the runtime is read-only', async () => {
  vi.useFakeTimers();
  const c = control(true);
  await c.installed.start();
  expect(c.options.start).toHaveBeenCalledTimes(1);
  let drained!: () => void;
  c.options.stop.mockImplementationOnce(() => new Promise<void>(done => { drained=done; }));
  const until = new Date(Date.now()+10000).toISOString();
  c.signal('pause',until); await flush();
  expect(crmRetirementMaintenance.active).toBe(true);
  expect(files.receipts).toHaveLength(0);
  drained(); await flush();
  expect(files.receipts.at(-1)?.drained).toBe(true);
  c.signal('resume',until); await flush();
  expect(crmRetirementMaintenance.active).toBe(true);
  c.options.runtimeReadOnly.mockResolvedValue(false);
  c.signal('resume',until); await flush();
  expect(crmRetirementMaintenance.active).toBe(false);
  expect(c.options.start).toHaveBeenCalledTimes(2);
  await c.installed.stop();
});
it('automatically recovers at the deadline only after the database fence is restored', async () => {
  vi.useFakeTimers();
  const c = control(true);
  await c.installed.start();
  c.signal('pause',new Date(Date.now()+1000).toISOString()); await flush();
  await vi.advanceTimersByTimeAsync(1000); await flush();
  expect(crmRetirementMaintenance.active).toBe(true);
  c.options.runtimeReadOnly.mockResolvedValue(false);
  await vi.advanceTimersByTimeAsync(1100); await flush();
  expect(crmRetirementMaintenance.active).toBe(false);
  expect(c.options.start).toHaveBeenCalledTimes(2);
  await c.installed.stop();
});
