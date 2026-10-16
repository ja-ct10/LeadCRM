'use client';
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';

type Draft = { dirty: boolean; busy: boolean };
const Context = createContext<{ register: (id: string, draft?: Draft) => void; requestClose: () => void } | null>(null);

/** One close policy for Escape, backdrop, close buttons and form cancellation. */
export function usePanelCloseGuard(onClose: () => void, draft: Draft = { dirty: false, busy: false }) {
  const latest = useRef({ onClose, draft }); latest.current = { onClose, draft };
  const children = useRef(new Map<string, Draft>());
  const [confirming, setConfirming] = useState(false);
  const blocked = () => [latest.current.draft, ...children.current.values()].some(value => value.busy);
  const requestClose = useCallback(() => {
    if (blocked()) return;
    if ([latest.current.draft, ...children.current.values()].some(value => value.dirty)) setConfirming(true);
    else latest.current.onClose();
  }, []);
  const register = useCallback((id: string, value?: Draft) => { if (value) children.current.set(id, value); else children.current.delete(id); }, []);
  const context = useMemo(() => ({ register, requestClose }), [register, requestClose]);
  const confirmation = <ConfirmActionDialog open={confirming} onOpenChange={setConfirming} title="Discard unsaved changes?"
    description="Your changes have not been saved." confirmLabel="Discard changes" cancelLabel="Keep editing" variant="warning"
    onConfirm={() => { if (blocked()) return false; setConfirming(false); latest.current.onClose(); }} />;
  return { requestClose, context, confirmation };
}
export const PanelCloseContext = Context;
export function usePanelDraft(draft: Draft) {
  const context = useContext(Context), id = useId();
  useEffect(() => { context?.register(id, draft); return () => context?.register(id); }, [context, id, draft.dirty, draft.busy]);
  return context?.requestClose;
}
