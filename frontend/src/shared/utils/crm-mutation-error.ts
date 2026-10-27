import { feedbackError } from './feedback-error';
import { toast } from '@/shared/utils/toast';
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import type { ApiRequestError } from '@/lib/api/client';

export function isStaffEmailError(error: unknown) {
  return (error as ApiRequestError)?.code === 'STAFF_EMAIL_NOT_ALLOWED';
}

/** Keep server field validation visible on the same inputs after a toast closes. */
export function applyCrmFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly FieldPath<T>[]) {
  const errors = (error as ApiRequestError)?.fieldErrors;
  if (!errors) return;
  for (const field of fields) if (errors[field]?.[0]) setError(field, { type: 'server', message: errors[field][0] });
}

export function showCrmMutationError(error: unknown, fallback: string) {
  if (isStaffEmailError(error)) return;
  const message = feedbackError(error, fallback);
  if ((error as { status?: number })?.status === 403) toast.error(message);
  else toast.error(message);
}
