'use client';

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/components/ui/button';

/** Shared presentation; each module retains its permission and mutation rules. */
export function SelectedRowsBar({ count, onClear, children, disabled = false }: {
  count: number; onClear: () => void; children: ReactNode; disabled?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const scope = anchor.current?.closest('main') ?? anchor.current?.parentElement;
    setToolbar(scope?.querySelector<HTMLElement>('[data-selection-toolbar]') ?? null);
  }, [count]);
  return <>
    <span ref={anchor} hidden />
    {count > 0 && <>
    <style>{`[data-selection-toolbar] { position: relative; } [data-selection-toolbar]:has(> [data-selected-row-actions]) > :not([data-selected-row-actions]) { visibility: hidden; }`}</style>
    {createPortal(<section data-selected-row-actions role="toolbar" aria-label="Selected row actions"
      className={(toolbar ? 'absolute inset-0 z-10 flex min-w-0 items-center gap-2 overflow-x-auto rounded-lg bg-background px-1 ' : 'fixed inset-x-3 bottom-3 z-40 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-background p-3 shadow-xl ') + 'text-sm text-foreground [&_button]:h-9 [&_button]:shrink-0 [&_button]:whitespace-nowrap [&_button]:rounded-lg [&_button]:px-3'}>
      <span aria-live="polite" className="whitespace-nowrap px-1 tabular-nums">{count} selected</span>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onClear}>Clear selection</Button>
      {children}
    </section>, toolbar ?? document.body)}
    </>}
  </>;
}
