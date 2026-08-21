import { toast } from 'sonner';

/**
 * Options for API error handling behavior.
 */
interface ApiErrorOptions {
  /** Callback to retry the failed operation. Shows a "Retry" action button in the toast. */
  onRetry?: () => void;
}

/**
 * Extracts HTTP status code from various error shapes.
 * Supports: Response objects, objects with `status` or `statusCode` property,
 * and message-based detection for errors thrown by apiClient.
 */
function extractStatus(error: unknown): number | null {
  // Handle Response objects (from raw fetch)
  if (error instanceof Response) {
    return error.status;
  }

  // Handle objects with status or statusCode property
  if (error && typeof error === 'object') {
    if ('status' in error && typeof (error as Record<string, unknown>).status === 'number') {
      return (error as { status: number }).status;
    }
    if ('statusCode' in error && typeof (error as Record<string, unknown>).statusCode === 'number') {
      return (error as { statusCode: number }).statusCode;
    }
  }

  // Detect status from error message patterns (apiClient throws plain Error with server message)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('authentication required') || msg.includes('invalid or expired token')) {
      return 401;
    }
    if (msg.includes('access denied')) {
      return 403;
    }
    if (msg === 'not found' || msg.includes('not found')) {
      return 404;
    }
  }

  return null;
}

/**
 * Handles API errors from deal mutations by displaying appropriate toast notifications.
 *
 * Behavior by status:
 * - 401: Redirects to login page
 * - 403: Shows "Access denied" toast
 * - 404: Shows "Record not found" toast
 * - Other/network: Shows error toast with optional retry action
 *
 * @param error - The caught error (Error, Response, or object with status)
 * @param options - Optional configuration (e.g., retry callback)
 */
export function handleApiError(error: unknown, options?: ApiErrorOptions): void {
  const status = extractStatus(error);

  switch (status) {
    case 401:
      window.location.href = '/login';
      return;

    case 403:
      toast.error('Access denied', {
        description: 'You do not have permission for this action.',
      });
      return;

    case 404:
      toast.error('Record not found', {
        description: 'The record may have been deleted.',
      });
      return;

    default: {
      const message = error instanceof Error
        ? error.message
        : 'An unexpected error occurred';

      toast.error('Operation failed', {
        description: message,
        action: options?.onRetry
          ? { label: 'Retry', onClick: options.onRetry }
          : undefined,
      });
    }
  }
}
