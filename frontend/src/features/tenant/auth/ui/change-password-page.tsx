'use client';
import { useState, type FormEvent } from 'react';
import { StrongPasswordSchema } from '@leadcrm/shared';
import { useAuth } from '@/store/AuthContext';
import { authApi } from '@/shared/services/auth.api';
import { OnboardingShell, primaryButton } from '../../onboarding/ui/onboarding-shell';
export default function ChangePasswordPage() {
  const { user, login } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !user) return;
    setError('');
    const parsed = StrongPasswordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, password);
      await login(user.email, password);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to change password.'); }
    finally { setSaving(false); }
  }
  return <OnboardingShell step={0}>
    <h1 className="text-2xl font-bold">Change your temporary password</h1>
    <p className="my-4 text-slate-500">Choose a personal password before accessing LeadCRM. Use 8–72 characters with uppercase and lowercase letters, a number, and a special character.</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">Current password<input className="mt-1 block w-full rounded border p-3" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label>
      <label className="block">New password<input className="mt-1 block w-full rounded border p-3" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="block">Confirm new password<input className="mt-1 block w-full rounded border p-3" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button className={primaryButton} disabled={saving}>{saving ? 'Saving…' : 'Change password and continue'}</button>
    </form>
  </OnboardingShell>;
}
