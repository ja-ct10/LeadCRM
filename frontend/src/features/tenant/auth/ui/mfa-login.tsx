'use client';
import { useState } from 'react';
import { MfaProofSchema, TotpCodeSchema } from '@leadcrm/shared';
import { authApi } from '@/shared/services/auth.api';
import { useAuth } from '@/store/AuthContext';
export function MfaLogin({ onCancel }: { onCancel: () => void }) {
  const { applyAuthUser } = useAuth();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const parsed = (recovery ? MfaProofSchema : TotpCodeSchema).safeParse(code);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError('');
    try { const response = await authApi.verifyMfa(code); setCode(''); applyAuthUser(response.data.user); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification failed.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 p-6"><form onSubmit={submit} className="w-full max-w-md bg-white dark:bg-slate-900 border rounded-2xl p-8 space-y-5"><h1 className="text-2xl font-semibold">Two-Factor Authentication</h1><p>{recovery ? 'Enter one of your saved recovery codes.' : 'Enter the code from your authenticator app.'}</p><label htmlFor="login-mfa-code" className="block">{recovery ? 'Recovery code' : 'Authenticator code'}</label><input id="login-mfa-code" autoFocus autoComplete="one-time-code" inputMode={recovery ? 'text' : 'numeric'} maxLength={recovery ? 17 : 6} value={code} onChange={e => setCode(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'login-mfa-error' : undefined} className="border rounded-lg p-3 w-full bg-transparent" />{error && <p id="login-mfa-error" role="alert" className="text-red-600">{error}</p>}<button disabled={busy} className="bg-blue-600 text-white w-full rounded-lg p-3">{busy ? 'Verifying…' : 'Verify'}</button><button type="button" onClick={() => { setRecovery(!recovery); setCode(''); setError(''); }}>{recovery ? 'Use authenticator code' : 'Use recovery code'}</button><button type="button" className="block" onClick={onCancel}>Back to sign in</button></form></div>;
}
