// Wake the existing revision stream after local commits. Persisted revisions and
// its bounded polling remain authoritative across replicas and reconnects.
const listeners = new Map<string, Set<() => void>>();
export function subscribeRecordChanges(tenantId: string, listener: () => void) {
  const scoped = listeners.get(tenantId) ?? new Set<() => void>();
  scoped.add(listener); listeners.set(tenantId, scoped);
  return () => { scoped.delete(listener); if (!scoped.size) listeners.delete(tenantId); };
}
export function notifyRecordChanges(tenantId: string) { listeners.get(tenantId)?.forEach(listener => listener()); }
