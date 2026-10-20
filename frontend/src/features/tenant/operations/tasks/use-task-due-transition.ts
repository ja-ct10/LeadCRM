'use client';
import { useEffect, useReducer, useRef } from 'react';
import { invalidatePageCache } from '@/shared/cache/page-cache';

// One timeout for all mounted Task views, including a standalone Details panel.
const transitions = new Map<symbol, { at: number; refresh: () => void }>();
let timer: ReturnType<typeof setTimeout> | undefined;
function schedule() {
  clearTimeout(timer);
  const next = Math.min(...[...transitions.values()].map(value => value.at));
  if (!Number.isFinite(next)) return;
  timer = setTimeout(() => {
    const now = Date.now();
    const due = [...transitions].filter(([, value]) => value.at <= now);
    for (const [id] of due) transitions.delete(id);
    if (due.length) {
      invalidatePageCache('tasks');
      for (const [, value] of due) value.refresh();
    }
    schedule();
  }, Math.min(2_147_483_647, Math.max(1, next - Date.now())));
}

export function useTaskDueTransition(next?: string | null, evaluatedAt?: string) {
  const [, refresh] = useReducer(value => value + 1, 0);
  const observation = useRef({ evaluatedAt, at: Date.now() });
  if (observation.current.evaluatedAt !== evaluatedAt) observation.current = { evaluatedAt, at: Date.now() };
  useEffect(() => {
    if (!next) return;
    const at = evaluatedAt ? observation.current.at + Date.parse(next) - Date.parse(evaluatedAt) : Date.parse(next);
    if (!Number.isFinite(at) || !evaluatedAt && at < Date.now()) return;
    const id = Symbol();
    transitions.set(id, { at: Math.max(Date.now(), at) + 1, refresh });
    schedule();
    return () => { transitions.delete(id); schedule(); };
  }, [next, evaluatedAt]);
}
