'use client';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Check, Circle } from 'lucide-react';
import { StrongPasswordSchema } from '@leadcrm/shared';
import { authApi } from '@/shared/services/auth.api';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';

const requirements = [
  ['At least 8 characters', (value: string) => value.length >= 8],
  ['One uppercase letter', (value: string) => /[A-Z]/.test(value)],
  ['One lowercase letter', (value: string) => /[a-z]/.test(value)],
  ['One number', (value: string) => /\d/.test(value)],
  ['One special character', (value: string) => /[^a-zA-Z0-9\s]/.test(value)],
] as const;
export function PasswordChangeForm({ onSuccess, onCancel, onBusy }: { onSuccess?: () => void; onCancel?: () => void; onBusy?: (busy: boolean) => void }) {
  const { user, applyAuthUser } = useAuth();
  const [values, setValues] = useState({ current: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values | 'form', string>>>({});
  const [shown, setShown] = useState({ current: false, password: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const score = requirements.filter(([, check]) => check(values.password)).length;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !user) return;
    const next: typeof errors = {};
    if (!values.current) next.current = 'Current password is required.';
    const parsed = StrongPasswordSchema.safeParse(values.password);
    if (!parsed.success) next.password = parsed.error.issues[0].message;
    if (!values.confirm) next.confirm = 'Confirm your new password.';
    else if (values.confirm !== values.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    onBusy?.(true);
    try {
      const response = await authApi.changePassword(values.current, values.password);
      applyAuthUser(response.data.user, user.id);
      setValues({ current: '', password: '', confirm: '' });
      toast.success('Password changed successfully.');
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password.';
      setErrors({ [message.startsWith('Current password') ? 'current' : message.startsWith('Choose a password') ? 'password' : 'form']: message });
    } finally { setBusy(false); onBusy?.(false); }
  }
  return <form onSubmit={submit} noValidate className="space-y-4">
    {([['current', 'Current Password'], ['password', 'New Password'], ['confirm', 'Confirm New Password']] as const).map(([key, label]) => <div key={key}>
      <label className="block text-sm font-medium mb-1" htmlFor={`security-${key}`}>{label} *</label>
      <div className="relative"><input id={`security-${key}`} type={shown[key] ? 'text' : 'password'} autoComplete={key === 'current' ? 'current-password' : 'new-password'}
        value={values[key]} maxLength={72} disabled={busy} required aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined}
        onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} className="w-full rounded-lg border p-3 pr-12 bg-transparent" />
        <button type="button" aria-label={`${shown[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setShown(previous => ({ ...previous, [key]: !previous[key] }))} className="absolute right-3 top-3">{shown[key] ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      {errors[key] && <p id={`${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{errors[key]}</p>}
      {key === 'password' && <div className="mt-3 space-y-2">
        <div role="progressbar" aria-label="Password requirements met" aria-valuemin={0} aria-valuemax={5} aria-valuenow={score} className="h-2 rounded bg-slate-200 overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${score * 20}%` }} /></div>
        <p className="text-xs text-slate-500">{['Very weak', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'][score]} · {score}/5 requirements met. Maximum 72 bytes.</p>
        <ul className="text-xs space-y-1">{requirements.map(([text, check]) => <li key={text} className="flex items-center gap-2">{check(values.password) ? <Check size={14} aria-label="Met" /> : <Circle size={14} aria-label="Not met" />}{text}</li>)}</ul>
      </div>}
    </div>)}
    {errors.form && <p role="alert" className="text-sm text-red-600">{errors.form}</p>}
    <div className="flex justify-end gap-2">{onCancel && <button type="button" disabled={busy} onClick={onCancel} className="border rounded-lg px-4 py-2">Cancel</button>}<button disabled={busy} className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? 'Saving…' : 'Change Password'}</button></div>
  </form>;
}
