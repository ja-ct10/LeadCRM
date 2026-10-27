'use client';

import { type ReactNode } from 'react';
import { Compass, type LucideIcon } from 'lucide-react';
import { useLogoutConfirmation } from '@/shared/providers/logout-confirmation-provider';
import { AppLogo } from '@/shared/components/app-logo';
import { CamxianBrandPanel } from '../../pages/camxian-brand-panel';

export function OnboardingShell({
  step, totalSteps, title = 'Welcome to LeadCRM', description = 'Your customer relationships and daily work, together.',
  icon: Icon = Compass, children,
}: { step: number; totalSteps?: number; title?: string; description?: string; icon?: LucideIcon; children: ReactNode }) {
  const requestLogout = useLogoutConfirmation();
  return (
    <main className="flex min-h-[var(--app-viewport-height)] flex-col bg-white text-slate-900 lg:flex-row dark:bg-slate-950 dark:text-white">
      <CamxianBrandPanel branding={<AppLogo className="w-full p-2.5" />} footer={totalSteps ? <div className="max-w-lg">
          <p className="mb-3 text-sm text-blue-50">Step {step + 1} of {totalSteps}</p>
          <ol aria-label="Onboarding progress" className="flex gap-2">
            {Array.from({ length: totalSteps }, (_, index) => <li key={index}
              aria-current={index === step ? 'step' : undefined}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-white' : 'bg-white/30'}`}>
              <span className="sr-only">Step {index + 1}{index < step ? ', visited' : ''}</span>
            </li>)}
          </ol>
        </div> : <p className="text-sm text-blue-50">Camxian Technologies · Secure account setup</p>}>
        <div className="max-w-lg py-2 lg:py-8">
          <Icon aria-hidden="true" className="mb-5 h-10 w-10 lg:mb-8 lg:h-14 lg:w-14" strokeWidth={1.5} />
          <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">{title}</h2>
          <p className="mt-4 text-base leading-relaxed text-blue-100">{description}</p>
        </div>
      </CamxianBrandPanel>
      <section className="flex w-full min-w-0 flex-col px-5 py-5 sm:px-10 lg:w-1/2 lg:px-12 xl:px-16">
        <div className="mb-6 flex justify-end">
          <button type="button" onClick={requestLogout}
            className="min-h-11 rounded-lg px-2 text-sm text-slate-500 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
            Sign out
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-4 lg:py-10">
          {children}
        </div>
      </section>
    </main>
  );
}

export const primaryButton =
  'min-h-11 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50';
export const secondaryButton =
  'min-h-11 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-primary dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50';
