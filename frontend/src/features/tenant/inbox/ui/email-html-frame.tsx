'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mailboxDisplayDocument } from '../services/email-html';

export function EmailHtmlFrame({ body, inlineImages }: { body: string; inlineImages: Record<string, string> }) {
  const source = useMemo(() => mailboxDisplayDocument(body || '<p>(No content)</p>', inlineImages), [body, inlineImages]);
  const [height, setHeight] = useState(80);
  const cleanup = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => cleanup.current?.(), []);
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
      const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
      observer?.observe(doc.body); doc.addEventListener('load', measure, true); doc.addEventListener('toggle', measure, true);
      measure();
      cleanup.current = () => { observer?.disconnect(); doc.removeEventListener('load', measure, true); doc.removeEventListener('toggle', measure, true); };
    }} />;
}
