import type { CrmEnvironment } from '@leadcrm/shared';

// A transport snapshot, populated only by AuthContext; never an authorization source.
let environment: CrmEnvironment | null = null;
let generation = 0;
let switching = false;
const mutations = new Set<Promise<unknown>>();
export const isEnvironmentPath = (path: string) => /^\/(crm|marketing|operations|automation|reporting|notifications|integrations)(\/|$)/.test(path) || path.startsWith('/administration/audit');
export function setTransportEnvironment(value: CrmEnvironment | null) {
  if (environment !== value) generation++;
  environment = value;
}
export function environmentSnapshot() { return { environment, generation, switching }; }
export async function beginEnvironmentSwitch() {
  switching = true;
  await Promise.allSettled([...mutations]);
}
export function endEnvironmentSwitch() { switching = false; }
export function trackEnvironmentMutation<T>(promise: Promise<T>): Promise<T> {
  mutations.add(promise);
  void promise.finally(() => mutations.delete(promise)).catch(() => {});
  return promise;
}
