'use client';
import { useEffect, useRef, useState } from 'react';
import { CurrentPasswordSchema, MfaProofSchema, TotpCodeSchema, type MfaSetup, type MfaStatus } from '@leadcrm/shared';
import { authApi } from '@/shared/services/auth.api';
import { useAuth } from '@/store/AuthContext';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { PasswordChangeForm } from './password-change-form';
import { ShieldCheck } from 'lucide-react';

type Mode = 'password' | 'setup' | 'disable' | 'regenerate';
const button = 'rounded-lg border px-3 py-2 text-sm disabled:opacity-50';
export function SecuritySettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode | null>(null);
  const refresh = () => authApi.mfaStatus().then(response => { setStatus(response.data); setError(''); }).catch(() => setError('Unable to load security settings. Please retry.'));
  useEffect(() => { let active = true; setStatus(null); authApi.mfaStatus().then(response => { if (active) setStatus(response.data); }).catch(() => { if (active) setError('Unable to load security settings. Please retry.'); }); return () => { active = false; }; }, [user?.id]);
  return <section className="rounded-2xl border bg-white dark:bg-[#25313D] p-5 space-y-4">
    <div><h3 className="font-semibold">Security</h3><p className="text-xs text-slate-500">Manage your password and two-factor authentication</p></div>
    {error && <p role="alert">{error} <button onClick={refresh}>Retry</button></p>}
    <div className="rounded-xl bg-slate-50 dark:bg-[#1B252F] p-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Password</p>{status?.passwordChangedAt && <p className="text-xs text-slate-500">Last changed: {new Date(status.passwordChangedAt).toLocaleDateString()}</p>}</div><button className={button} onClick={() => setMode('password')}>Change Password</button></div>
    <div className="rounded-xl bg-slate-50 dark:bg-[#1B252F] p-3 space-y-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">Two-Factor Authentication</p><span className="text-xs">{status ? status.enabled ? 'Enabled' : 'Not enabled' : 'Loading…'}</span></div>
      {status?.enabled ? <><p className="text-xs text-slate-500">Authenticator app · {status.recoveryCodesRemaining} recovery codes remaining</p><div className="flex flex-wrap gap-2"><button className={button} onClick={() => setMode('regenerate')}>Regenerate Recovery Codes</button><button className={button} onClick={() => setMode('disable')}>Disable Two-Factor Authentication</button></div></> : <button className={button} disabled={!status} onClick={() => setMode('setup')}>Enable Two-Factor Authentication</button>}
    </div>
    {mode && <SecurityDialog key={`${user?.id}-${mode}`} mode={mode} onClose={() => setMode(null)} onChanged={refresh} />}
  </section>;
}
function SecurityDialog({ mode, onClose, onChanged }: { mode: Mode; onClose: () => void; onChanged: () => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('input, button')?.focus(), 0);
    return () => { clearTimeout(timer); previous?.focus(); };
  }, []);
  const title = mode === 'password' ? 'Change password' : mode === 'setup' ? 'Set Up Two-Factor Authentication' : mode === 'disable' ? 'Disable Two-Factor Authentication' : 'Regenerate Recovery Codes';
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!setup && !CurrentPasswordSchema.safeParse(password).success) { setError('Current password is required.'); return; }
    if ((setup || mode !== 'setup') && !(setup ? TotpCodeSchema : MfaProofSchema).safeParse(code).success) { setError(setup ? 'Enter a 6-digit authenticator code.' : 'Enter a valid authenticator or recovery code.'); return; }
    setBusy(true);
    try {
      if (mode === 'setup' && !setup) { setSetup((await authApi.setupMfa(password)).data); setPassword(''); }
      else if (mode === 'disable') { await authApi.disableMfa(password, code); onChanged(); onClose(); }
      else {
        const response = mode === 'setup' ? await authApi.enableMfa(code) : await authApi.regenerateMfaRecoveryCodes(password, code);
        setCodes(response.data.recoveryCodes); setSetup(null); setPassword(''); setCode(''); onChanged();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update security settings.'); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent ref={dialogRef} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)') ?? []);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} aria-labelledby="security-dialog-title" aria-describedby={mode === 'password' ? 'password-dialog-description' : undefined} className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
    {mode === 'password' ? <div className="mb-5 border-b border-gray-200 dark:border-slate-700 pb-5">
      <div className="mb-4 inline-flex rounded-lg bg-blue-50 dark:bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400"><ShieldCheck size={20} aria-hidden="true" /></div>
      <DialogTitle id="security-dialog-title">{title}</DialogTitle>
      <p id="password-dialog-description" className="mt-2 text-xs text-slate-500 dark:text-slate-400">Keep your account secure with a strong password.</p>
    </div> : <DialogTitle id="security-dialog-title" className="mb-4">{title}</DialogTitle>}
    {mode === 'password' ? <PasswordChangeForm onBusy={setBusy} onSuccess={() => { onChanged(); onClose(); }} onCancel={onClose} /> : codes ? <div className="space-y-4"><p>Save these recovery codes in a secure location. They will not be shown again.</p><ul className="grid grid-cols-2 gap-2 font-mono text-sm">{codes.map(value => <li key={value}>{value}</li>)}</ul><button className={button} onClick={onClose}>I saved my recovery codes</button></div> : <form onSubmit={submit} className="space-y-4">
      {setup ? <><p className="text-sm">Scan this QR code with your authenticator app, then enter its 6-digit code.</p><img src={setup.qrCode} alt="Authenticator setup QR code" width={220} height={220} className="mx-auto" /><p className="text-xs">Manual setup key:</p><code className="block break-all select-all">{setup.secret}</code><p className="text-xs text-slate-500">Setup expires after 10 minutes.</p></> : <div><label htmlFor="mfa-password" className="block text-sm mb-1">Current Password *</label><input id="mfa-password" autoFocus type="password" autoComplete="current-password" maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg p-3 bg-transparent" /></div>}
      {(setup || mode !== 'setup') && <div><label htmlFor="mfa-code" className="block text-sm mb-1">{setup ? 'Authenticator Code' : 'Authenticator or Recovery Code'} *</label><input id="mfa-code" autoComplete="one-time-code" inputMode={setup ? 'numeric' : 'text'} pattern={setup ? '[0-9]{6}' : '(?:[0-9]{6}|[a-f0-9]{8}-[a-f0-9]{8})'} maxLength={setup ? 6 : 17} required value={code} onChange={e => setCode(e.target.value)} className="w-full border rounded-lg p-3 bg-transparent" /></div>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} className={button} onClick={onClose}>Cancel</button><button disabled={busy} className={`${button} bg-blue-600 text-white`}>{busy ? 'Working…' : setup ? 'Verify & Enable' : mode === 'setup' ? 'Continue' : mode === 'disable' ? 'Disable' : 'Regenerate'}</button></div>
    </form>}
  </DialogContent></Dialog>;
}
