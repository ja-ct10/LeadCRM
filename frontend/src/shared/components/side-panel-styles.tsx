import type { ReactNode } from 'react';

// Presentation only: callers retain their existing dialog and form behavior.
export const panelThemeClass =
  'border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 [color-scheme:light] dark:[color-scheme:dark] [--primary:var(--color-blue-600)] [--focus-ring:0_0_0_3px_rgb(37_99_235_/_0.2)] [--surface:#fff] [--text-primary:#334155] dark:[--surface:#0f172a] dark:[--text-primary:#e2e8f0]';
export const panelSurfaceClass =
  'h-dvh w-full max-w-lg sm:max-w-lg md:max-w-xl ' + panelThemeClass;
export const panelHeaderClass =
  'shrink-0 border-b border-slate-100 bg-slate-50/50 px-4 py-5 sm:px-6 dark:border-white/5 dark:bg-white/[0.01]';
export const panelTitleClass =
  'text-xl font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere] dark:text-white';
export const panelBodyClass =
  'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6';
export const panelFooterClass =
  'shrink-0 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 dark:border-white/10 dark:bg-slate-900';
export const panelLabelClass =
  'block text-xs font-semibold text-slate-600 dark:text-slate-300';
export const panelInputClass =
  'min-h-[42px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-700 disabled:opacity-100 disabled:[--surface:#f8fafc] dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-200 dark:disabled:[--surface:#172033]';
export const panelSecondaryButtonClass =
  'h-[42px] rounded-xl border-slate-200 bg-slate-100 px-5 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
export const panelPrimaryButtonClass =
  'h-[42px] rounded-xl px-6 shadow-lg shadow-blue-600/20';
export const panelCloseClass =
  'h-11 w-11 shrink-0 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
export const panelPrimaryActionClass = panelPrimaryButtonClass +
  ' inline-flex items-center justify-center gap-2 bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const panelSecondaryActionClass = panelSecondaryButtonClass +
  ' inline-flex items-center justify-center gap-2 border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function PanelSectionHeading({ number, children }: { number: number; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 text-sm font-bold text-slate-900 dark:text-white">
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{number}</span>
      <span className="min-w-0">{children}</span>
      <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-slate-200 dark:bg-white/10" />
    </h3>
  );
}
