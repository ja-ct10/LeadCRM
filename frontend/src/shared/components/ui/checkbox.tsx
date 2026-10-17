'use client';

import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked: controlledChecked, defaultChecked = false, indeterminate = false, onCheckedChange, disabled, ...props }, ref) => {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : uncontrolledChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const next = e.target.checked;
      if (!isControlled) {
        setUncontrolledChecked(next);
      }
      onCheckedChange?.(next);
    };

    return (
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          ref={node => {
            if (node) node.indeterminate = indeterminate;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          checked={checked}
          aria-checked={indeterminate ? 'mixed' : checked}
          disabled={disabled}
          onChange={handleChange}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary/40 bg-card transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            (checked || indeterminate) && 'border-primary bg-primary text-primary-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
        >
          {indeterminate ? <Minus aria-hidden="true" className="h-3 w-3 text-primary-foreground stroke-[3]" /> : checked && <Check aria-hidden="true" className="h-3 w-3 text-primary-foreground stroke-[3]" />}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
