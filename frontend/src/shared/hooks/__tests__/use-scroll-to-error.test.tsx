/**
 * Unit tests for useScrollToError hook.
 *
 * Validates Requirements:
 * - 10.6: Inline error on blur/submit within 100ms
 * - 10.7: Scroll to and focus first error field on submit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollToError } from '../use-scroll-to-error';
import React from 'react';
import type { FieldErrors } from 'react-hook-form';

// Helper to create a mock form element with named fields
function createMockFormRef(fieldNames: string[]): React.RefObject<HTMLFormElement> {
  const form = document.createElement('form');

  fieldNames.forEach((name) => {
    const input = document.createElement('input');
    input.setAttribute('name', name);
    input.scrollIntoView = vi.fn();
    input.focus = vi.fn();
    form.appendChild(input);
  });

  return { current: form } as React.RefObject<HTMLFormElement>;
}

type TestFormShape = Record<string, unknown>;

describe('useScrollToError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not scroll when there are no errors', () => {
    const formRef = createMockFormRef(['firstName', 'lastName']);
    const errors: FieldErrors<TestFormShape> = {};

    renderHook(() =>
      useScrollToError({ errors, formRef }),
    );

    const firstInput = formRef.current!.querySelector('[name="firstName"]') as HTMLElement;
    expect(firstInput.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls to the first error field when errors appear', () => {
    const formRef = createMockFormRef(['firstName', 'lastName', 'email']);
    const errors: FieldErrors<TestFormShape> = {
      lastName: { type: 'required', message: 'Last name is required' },
      email: { type: 'pattern', message: 'Invalid email' },
    };

    renderHook(() =>
      useScrollToError({ errors, formRef }),
    );

    const lastNameInput = formRef.current!.querySelector('[name="lastName"]') as HTMLElement;
    expect(lastNameInput.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('focuses the first error field after scroll delay', () => {
    const formRef = createMockFormRef(['firstName', 'email']);
    const setFocus = vi.fn();
    const errors: FieldErrors<TestFormShape> = {
      email: { type: 'pattern', message: 'Invalid email' },
    };

    renderHook(() =>
      useScrollToError({ errors, formRef, setFocus }),
    );

    // Focus happens after a 100ms timeout
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(setFocus).toHaveBeenCalledWith('email');
  });

  it('does not re-scroll when error count stays the same', () => {
    const formRef = createMockFormRef(['firstName']);
    const errors: FieldErrors<TestFormShape> = {
      firstName: { type: 'required', message: 'Required' },
    };

    const { rerender } = renderHook(
      ({ errors: e }) => useScrollToError({ errors: e, formRef }),
      { initialProps: { errors } },
    );

    const firstInput = formRef.current!.querySelector('[name="firstName"]') as HTMLElement;
    // Clear mock calls from initial render
    (firstInput.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();

    // Re-render with same errors
    rerender({ errors });

    // Should not scroll again
    expect(firstInput.scrollIntoView).not.toHaveBeenCalled();
  });

  it('supports data-field-name attribute for custom components', () => {
    const form = document.createElement('form');
    const customDiv = document.createElement('div');
    customDiv.setAttribute('data-field-name', 'value');
    customDiv.scrollIntoView = vi.fn();
    customDiv.focus = vi.fn();
    form.appendChild(customDiv);

    const formRef = { current: form } as React.RefObject<HTMLFormElement>;
    const errors: FieldErrors<TestFormShape> = {
      value: { type: 'min', message: 'Value too low' },
    };

    renderHook(() =>
      useScrollToError({ errors, formRef }),
    );

    expect(customDiv.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });
});
