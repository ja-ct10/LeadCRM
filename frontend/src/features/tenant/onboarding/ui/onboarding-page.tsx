'use client';
import { useOnboarding } from '../hooks/use-onboarding';
import { OnboardingShell, primaryButton } from './onboarding-shell';
const topics = [
  ['Lead management', 'Capture inquiries, qualify opportunities, and coordinate follow-ups.'],
  ['Customers and accounts', 'Keep customer details, company information, and relationship history together.'],
  ['Deals and pipelines', 'Track opportunities through each sales stage and understand what needs attention.'],
  ['Workflows and processes', 'Coordinate tasks, activities, and repeatable processes across your team.'],
];
export default function OnboardingPage() {
  const { complete, isSaving, error } = useOnboarding();
  return <OnboardingShell step={0}>
    <h1 className="mb-3 text-3xl font-bold">Welcome to LeadCRM</h1>
    <p className="mb-8 text-slate-500">Camxian Technologies’ internal CRM brings customer relationships and daily work into one shared environment.</p>
    <div className="space-y-6">{topics.map(([title, description]) => <div key={title}>
      <h2 className="font-semibold">{title}</h2><p className="text-sm text-slate-500">{description}</p>
    </div>)}</div>
    {error && <p role="alert" className="mt-6 text-red-600">{error}</p>}
    <button className={primaryButton + ' mt-8'} disabled={isSaving} onClick={() => void complete()}>
      {isSaving ? 'Saving…' : 'Continue to dashboard'}
    </button>
  </OnboardingShell>;
}
