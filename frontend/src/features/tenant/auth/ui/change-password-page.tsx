"use client";
import { OnboardingShell } from '../../onboarding/ui/onboarding-shell';
import { PasswordChangeForm } from '../../settings/ui/password-change-form';
export default function ChangePasswordPage() {
  return <OnboardingShell step={0}><h1 className="text-2xl font-bold mb-4">Change your temporary password</h1><PasswordChangeForm /></OnboardingShell>;
}
