"use client";
import { OnboardingShell } from '../../onboarding/ui/onboarding-shell';
import { PasswordChangeForm } from '../../settings/ui/password-change-form';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { isOnboardingComplete } from '@leadcrm/shared';
export default function ChangePasswordPage() {
  const { user } = useAuth();
  const returning = user && isOnboardingComplete(user);
  return <OnboardingShell step={0} icon={ShieldCheck} title={returning ? 'Keep your account secure' : 'Make your account your own'}
    description="Choose a strong password to secure your LeadCRM account before you enter the workspace.">
    <h1 className="mb-3 text-2xl font-bold sm:text-3xl">{returning ? 'Change your password' : 'Change your temporary password'}</h1>
    <p className="mb-8 text-slate-500">{returning ? 'Choose a new password to continue to your workspace.' : 'Create your permanent password to continue. You will then take a short tour of LeadCRM.'}</p>
    <PasswordChangeForm />
  </OnboardingShell>;
}
