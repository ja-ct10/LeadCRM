import { toast as sonnerToast, type ExternalToast } from 'sonner';
import { feedbackMessage } from './feedback-error';

function options(defaultDuration: number, value?: ExternalToast): ExternalToast {
  return {
    duration: value?.action || value?.cancel ? 12000 : defaultDuration,
    ...value,
    ...(typeof value?.description === 'string' ? { description: feedbackMessage(value.description) } : {}),
  };
}

// Keep Sonner's IDs, dismissal, promise/loading updates and subscriptions on the same store.
export const toast: typeof sonnerToast = Object.assign(
  ((message, value) => sonnerToast(message, options(4000, value))) as typeof sonnerToast,
  sonnerToast,
  {
    message: (message: Parameters<typeof sonnerToast.message>[0], value?: ExternalToast) => sonnerToast.message(message, options(4000, value)),
    success: (message: Parameters<typeof sonnerToast.success>[0], value?: ExternalToast) => sonnerToast.success(message, options(4000, value)),
    info: (message: Parameters<typeof sonnerToast.info>[0], value?: ExternalToast) => sonnerToast.info(message, options(4000, value)),
    warning: (message: Parameters<typeof sonnerToast.warning>[0], value?: ExternalToast) => sonnerToast.warning(message, options(8000, value)),
    error: (message: Parameters<typeof sonnerToast.error>[0], value?: ExternalToast) => sonnerToast.error(typeof message === 'string' ? feedbackMessage(message) : message, options(8000, value)),
  },
);
