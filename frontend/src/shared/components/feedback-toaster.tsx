'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

/** One responsive notification lane, clear of the active header and page action bars. */
export function FeedbackToaster({ dark }: { dark: boolean }) {
  const [layout, setLayout] = useState({ top: 68, count: 3 });
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mobile = window.innerWidth < 640;
        const laneLeft = mobile ? 12 : window.innerWidth - 404;
        let top = 16;
        document.querySelectorAll<HTMLElement>('header, [data-toast-clearance], [data-page-actions], [role=toolbar]').forEach(element => {
          if (element.closest('[inert], [data-sonner-toaster]')) return;
          const rect = element.getBoundingClientRect();
          if (rect.width && rect.height && rect.right > laneLeft && rect.top >= 0 && rect.top < window.innerHeight / 3) top = Math.max(top, rect.bottom + 12);
        });
        const count = window.innerHeight - top < 400 ? 1 : mobile ? 2 : 3;
        setLayout(previous => previous.top === top && previous.count === count ? previous : { top, count });
      });
    };
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    resize?.observe(document.body);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    measure();
    return () => { observer.disconnect(); resize?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, []);
  const top = `max(${layout.top}px, env(safe-area-inset-top))`;
  return <Toaster theme={dark ? 'dark' : 'light'} position="top-right" expand closeButton duration={4000} gap={12}
    visibleToasts={layout.count} offset={{ top, right: 'max(24px, env(safe-area-inset-right))', bottom: 16, left: 24 }}
    mobileOffset={{ top, right: 'max(12px, env(safe-area-inset-right))', left: 'max(12px, env(safe-area-inset-left))', bottom: 12 }}
    style={{ '--feedback-top': top, '--feedback-visible': layout.count } as React.CSSProperties}
    toastOptions={{ closeButtonAriaLabel: 'Dismiss notification' }} />;
}
