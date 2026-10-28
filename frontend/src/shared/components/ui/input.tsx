import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

// Shared by single-line fields, multiline fields and existing panel controls.
export const textFieldClassName = cn(
  "flex w-full rounded-md border bg-white dark:bg-slate-900 px-3 py-2 text-sm transition-all",
  "border-gray-200 dark:border-white/[0.08]",
  "placeholder:text-slate-400 dark:placeholder:text-slate-500",
  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]",
  "aria-invalid:border-red-500 dark:aria-invalid:border-red-500",
  "disabled:cursor-not-allowed disabled:opacity-50",
)

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          textFieldClassName,
          "h-9",
          className
        )}
        style={{
          color: 'var(--text-primary)',
          ...style,
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

