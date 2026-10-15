import { toast } from 'sonner';
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import type { ApiRequestError } from '@/lib/api/client';

/** Keep server field validation visible on the same inputs after a toast closes. */
export function applyCrmFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly FieldPath<T>[]) {
  const errors = (error as ApiRequestError)?.fieldErrors;
  if (!errors) return;
  for (const field of fields) if (errors[field]?.[0]) setError(field, { type: 'server', message: errors[field][0] });
}

export function showCrmMutationError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if ((error as { status?: number })?.status === 403) toast.error('Access Denied', { description: message });
  else toast.error(message);
}
