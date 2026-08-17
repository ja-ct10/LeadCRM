'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { FieldErrors, UseFormSetFocus } from 'react-hook-form';

/**
 * Reusable hook that scrolls to and focuses the first error field on form submission.
 *
 * Usage:
 * ```ts
 * const formRef = useRef<HTMLFormElement>(null);
 * const { setFocus, formState: { errors } } = useForm({ ... });
 * useScrollToError({ errors, formRef, setFocus });
 * ```
 *
 * Validates: Requirements 10.6, 10.7
 */
interface UseScrollToErrorOptions<T extends Record<string, unknown>> {
  /** react-hook-form errors object */
  errors: FieldErrors<T>;
  /** Ref to the form element */
  formRef: React.RefObject<HTMLFormElement | null>;
  /** react-hook-form setFocus function */
  setFocus?: UseFormSetFocus<T>;
}

export function useScrollToError<T extends Record<string, unknown>>({
  errors,
  formRef,
  setFocus,
}: UseScrollToErrorOptions<T>): void {
  const errorKeys = Object.keys(errors);
  const previousErrorCountRef = useRef(0);

  useEffect(() => {
    // Only trigger scroll when new errors appear (submit/blur triggered validation)
    if (errorKeys.length === 0) {
      previousErrorCountRef.current = 0;
      return;
    }

    // If errors increased or appeared fresh, scroll to first
    if (errorKeys.length > previousErrorCountRef.current || previousErrorCountRef.current === 0) {
      const firstErrorKey = errorKeys[0];
      if (firstErrorKey && formRef.current) {
        const field = formRef.current.querySelector(
          `[name="${firstErrorKey}"], [data-field-name="${firstErrorKey}"]`
        );
        if (field) {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Focus the field after scroll animation
          setTimeout(() => {
            if (setFocus) {
              try {
                setFocus(firstErrorKey as Parameters<typeof setFocus>[0]);
              } catch {
                // Field might not be focusable via react-hook-form (custom components)
                (field as HTMLElement).focus?.();
              }
            } else {
              (field as HTMLElement).focus?.();
            }
          }, 100);
        }
      }
    }

    previousErrorCountRef.current = errorKeys.length;
  }, [errorKeys.length, errorKeys[0], formRef, setFocus]);
}
