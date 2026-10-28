'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { textFieldClassName } from './input';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          textFieldClassName,
          'min-h-[80px]',
          className
        )}
        style={{ color: 'var(--text-primary)', ...style }}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
