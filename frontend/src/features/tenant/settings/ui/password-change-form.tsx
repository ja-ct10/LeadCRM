'use client';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Check, Circle } from 'lucide-react';
import { StrongPasswordSchema } from '@leadcrm/shared';
import { authApi } from '@/shared/services/auth.api';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';

const requirements = [
  ['At least 8 characters', (value: string) => value.length >= 8],
  ['One uppercase letter', (value: string) => /[A-Z]/.test(value)],
  ['One lowercase letter', (value: string) => /[a-z]/.test(value)],
  ['One number', (value: string) => /\d/.test(value)],
  ['One special character', (value: string) => /[^a-zA-Z0-9\s]/.test(value)],
] as const;
export function PasswordChangeForm({ onSuccess, onCancel, onBusy }: { onSuccess?: () => void; onCancel?: () => void; onBusy?: (busy: boolean) => void }) {
  const { user, applyAuthUser } = useAuth();
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values | 'form', string>>>({});
  const [shown, setShown] = useState({ password: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const score = requirements.filter(([, check]) => check(values.password)).length;
  const passwordValid = StrongPasswordSchema.safeParse(values.password).success;
  const canSubmit = passwordValid && values.confirm === values.password && !busy;
  const confirmError = values.confirm && values.confirm !== values.password
    ? 'Passwords do not match.'
    : confirmTouched && !values.confirm ? 'Confirm your new password.' : errors.confirm;
  const strength = ['Very weak', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const strengthColor = score === 5 ? 'bg-emerald-500' : score >= 3 ? 'bg-amber-500' : 'bg-rose-500';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !user) return;
    const next: typeof errors = {};
    const parsed = StrongPasswordSchema.safeParse(values.password);
    if (!parsed.success) next.password = parsed.error.issues[0].message;
    if (!values.confirm) next.confirm = 'Confirm your new password.';
    else if (values.confirm !== values.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    onBusy?.(true);
    try {
      const response = await authApi.changePassword({ password: values.password });
      applyAuthUser(response.data.user, user.id);
      setValues({ password: '', confirm: '' });
      setConfirmTouched(false);
      toast.success('Password changed successfully.');
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password.';
      setErrors({ [message.startsWith('Choose a password') ? 'password' : 'form']: message });
    } finally { setBusy(false); onBusy?.(false); }
  }
  return <form onSubmit={submit} noValidate className="space-y-4">
    {([['password', 'New password'], ['confirm', 'Confirm new password']] as const).map(([key, label]) => {
      const error = key === 'confirm' ? confirmError : errors.password;
      return <div key={key}>
      <label className="block text-xs font-semibold mb-1.5" htmlFor={`security-${key}`}>{label} <span className="text-red-500">*</span></label>
      <div className="relative"><input id={`security-${key}`} type={shown[key] ? 'text' : 'password'} autoComplete="new-password"
        value={values[key]} maxLength={72} disabled={busy} required aria-invalid={!!error} aria-describedby={error ? `${key}-error` : key === 'password' ? 'password-requirements' : undefined}
        onBlur={() => { if (key === 'confirm') setConfirmTouched(true); }}
        onChange={event => { setValues(previous => ({ ...previous, [key]: event.target.value })); setErrors({}); }} className="w-full min-w-0 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2.5 pr-12 text-sm bg-slate-50 dark:bg-[#1B252F] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        <button type="button" aria-label={`${shown[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setShown(previous => ({ ...previous, [key]: !previous[key] }))} className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-slate-500">{shown[key] ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      {error && <p id={`${key}-error`} role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
      {key === 'password' && <div className="mt-3 space-y-2" id="password-requirements">
        <div role="progressbar" aria-label="Password requirements met" aria-valuemin={0} aria-valuemax={5} aria-valuenow={score} aria-valuetext={strength} className="flex gap-1">
          {requirements.map(([text], index) => <span key={text} className={`h-1.5 min-w-0 flex-1 rounded-full transition-colors ${index < score ? strengthColor : 'bg-slate-200 dark:bg-slate-700'}`} />)}
        </div>
        <p className={`text-xs font-medium ${score === 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>{strength}</p>
        <ul className="pt-2 text-xs space-y-2">{requirements.map(([text, check]) => <li key={text} className={`flex items-center gap-2 ${check(values.password) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{check(values.password) ? <Check className="shrink-0" size={14} aria-label="Met" /> : <Circle className="shrink-0" size={14} aria-label="Not met" />}{text}</li>)}</ul>
        {values.password && new TextEncoder().encode(values.password).length > 72 && <p role="alert" className="text-xs text-red-600">Password must be no more than 72 bytes.</p>}
      </div>}
    </div>; })}
    {errors.form && <p role="alert" className="text-sm text-red-600">{errors.form}</p>}
    <div className="flex flex-wrap justify-end gap-2 pt-2">{onCancel && <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>}<Button type="submit" disabled={!canSubmit}>{busy ? 'Saving…' : 'Change password'}</Button></div>
  </form>;
}
