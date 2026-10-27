'use client';

import { Toaster } from 'sonner';

/** Keep the original top-right placement and Sonner's desktop/mobile offsets. */
export function FeedbackToaster({ dark }: { dark: boolean }) {
  return <Toaster theme={dark ? 'dark' : 'light'} position="top-right" expand closeButton duration={4000} gap={12}
    toastOptions={{ closeButtonAriaLabel: 'Dismiss notification' }} />;
}
