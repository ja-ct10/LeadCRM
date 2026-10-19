'use client';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mailboxDisplayDocument } from '../services/email-html';

export function EmailHtmlFrame({ body, inlineImages }: { body: string; inlineImages: Record<string, string> }) {
  const source = useMemo(() => mailboxDisplayDocument(body || '<p>(No content)</p>', inlineImages), [body, inlineImages]);
  const [height, setHeight] = useState(80);
  const cleanup = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => () => { cleanup.current?.(); cleanup.current = undefined; }, [source]);
  return <iframe data-mailbox-body title="Email message content" srcDoc={source}
    // Same-origin permits parent-side measurement only. Scripts remain disabled by sandbox AND CSP.
    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"
    className="block w-full min-w-0 max-w-full border-0 bg-white" style={{ height }}
    onLoad={event => {
      cleanup.current?.();
      const frame = event.currentTarget, doc = frame.contentDocument;
      if (!doc?.body) return;
      const measure = () => {
        const margins = frame.contentWindow?.getComputedStyle(doc.body);
        const next = Math.min(20000, Math.max(48, Math.ceil(Math.max(doc.body.scrollHeight, doc.body.getBoundingClientRect().height) + (parseFloat(margins?.marginTop ?? '') || 0) + (parseFloat(margins?.marginBottom ?? '') || 0))));
        setHeight(previous => previous === next ? previous : next);
      };
      let pendingFrame: number | undefined;
      // Defer cross-document height writes until ResizeObserver delivery has finished.
      const scheduleMeasure = () => {
        if (pendingFrame !== undefined) return;
        pendingFrame = window.requestAnimationFrame(() => { pendingFrame = undefined; measure(); });
      };
      const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleMeasure);
      observer?.observe(doc.body); doc.addEventListener('load', scheduleMeasure, true); doc.addEventListener('toggle', scheduleMeasure, true);
      scheduleMeasure();
      cleanup.current = () => {
        observer?.disconnect(); doc.removeEventListener('load', scheduleMeasure, true); doc.removeEventListener('toggle', scheduleMeasure, true);
        if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
      };
    }} />;
}
