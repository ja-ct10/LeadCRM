'use client';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
interface WorkflowDialogProps { title: string; onClose: () => void; children: ReactNode; }
export function WorkflowDialog({ title, onClose, children }: WorkflowDialogProps) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const focusDialog = useCallback((node: HTMLDivElement | null) => {
    if (node) { previousFocus.current = document.activeElement as HTMLElement; node.querySelector<HTMLElement>('button,input,select')?.focus(); }
  }, []);
  useEffect(() => () => previousFocus.current?.focus(), []);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent aria-label={title} className="max-w-3xl max-h-[90vh] overflow-y-auto" ref={focusDialog}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,summary,a[href],[tabindex="0"]'))
          .filter(element => !element.matches(':disabled') && !element.closest('[hidden]'));
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <div className="mt-5 space-y-5">{children}</div>
    </DialogContent>
  </Dialog>;
}
