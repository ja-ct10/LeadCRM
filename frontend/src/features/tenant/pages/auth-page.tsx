'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { authApi } from '@/shared/services/auth.api';
import { ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleSignInButton } from '@/shared/components/google-sign-in-button';

import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Mirrors the backend GuestRegisterSchema — firstName/lastName min 2,
// password min 8. Keep in sync with backend/src/core/auth/auth.dto.ts.
const guestSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Mirrors the backend ClientAdminRegisterSchema.
const clientAdminSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const RESEND_COOLDOWN = 30;

interface ResendOtpButtonProps {
  email: string;
  password: string;
  onResend: () => Promise<unknown>;
}

function ResendOtpButton({ email, password, onResend }: ResendOtpButtonProps): React.ReactElement {
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [isSending, setIsSending] = useState(false);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = useCallback(async () => {
    if (!canResend || isSending) return;
    setIsSending(true);
    try {
      await onResend();
      toast.success(`New code sent to ${email}`);
      setCountdown(RESEND_COOLDOWN);
      setCanResend(false);
    } catch {
      toast.error('Failed to resend code. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [canResend, isSending, onResend, email]);

  return (
    <div className="flex items-center justify-center gap-1.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400">Didn&apos;t receive it?</span>
      {canResend ? (
        <button
          type="button"
          onClick={handleResend}
          disabled={isSending}
          className="flex items-center gap-1 text-[#0A6EFF] hover:text-blue-400 font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isSending ? (
            <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" /> Resend code</>
          )}
        </button>
      ) : (
        <span className="text-slate-400 dark:text-slate-500 tabular-nums">
          Resend in <span className="text-slate-600 dark:text-slate-300 font-semibold">{countdown}s</span>
        </span>
      )}
    </div>
  );
}

export default function AuthPage({ mode, onNavigate, oauthError }: { mode: 'login' | 'register', onNavigate: (path: string) => void, oauthError?: string }) {
  const { login, verifyOtp, loginWithGoogle, registerTenant, registerGuestAccount, requestPasswordReset, confirmPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Forgot password view state
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'forgot-sent' | 'reset'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // ── Map NextAuth error codes to user-friendly messages ──────────────
  const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    AccessDenied: 'Google sign-in failed. Please make sure the backend server is running and try again.',
    OAuthAccountNotLinked: 'This email is already registered with a different sign-in method. Please use your original login method.',
    Configuration: 'Authentication is misconfigured. Please contact support.',
    OAuthSignin: 'Could not start the Google sign-in flow. Please try again.',
    OAuthCallback: 'Google sign-in callback failed. Please try again.',
    Default: 'An unexpected authentication error occurred. Please try again.',
  };

  // ── Show OAuth error from NextAuth redirect ─────────────────────────
  React.useEffect(() => {
    if (oauthError) {
      const message = OAUTH_ERROR_MESSAGES[oauthError] ?? OAUTH_ERROR_MESSAGES.Default;
      setError(message);
      toast.error(message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthError]);

  // Pick up ?token= from the URL for the reset-password deep link
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setResetToken(token);
        setAuthView('reset');
      }
    }
  }, []);
  
  // OTP State
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');
  const [showRegOTP, setShowRegOTP] = useState(false);

  // Registration state
  const [step, setStep] = useState(0); // 0 is Role Selection
  const [registrationType, setRegistrationType] = useState<'client' | 'guest' | null>(null);
  const [tenantData, setTenantData] = useState({ companyName: '', industry: 'IT Solutions', size: '1-10', businessEmail: '', phone: '', address: '' });
  const [businessReqs, setBusinessReqs] = useState({ requirements: '', documentName: '' });
  const [verificationDocs, setVerificationDocs] = useState({ businessPermit: '', taxId: '', validId: '' });
  const [adminData, setAdminData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [guestData, setGuestData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [botCheck, setBotCheck] = useState({ answer: '', expected: '', question: '' });

  React.useEffect(() => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setBotCheck(prev => ({ ...prev, expected: (num1 + num2).toString(), question: `What is ${num1} + ${num2}?` }));
  }, [step]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      loginSchema.parse({ email, password });
    } catch (err: unknown) {
      const zodErr = err as { errors?: Array<{message: string}> };
      setError(zodErr.errors?.[0]?.message || 'Validation failed');
      return;
    }

    if (!showOTP) {
      // Step 1 — verify credentials + send OTP via email
      const sent = await login(email, password);
      if (sent) {
        setShowOTP(true);
        setError('');
      } else {
        setError('Invalid credentials or account inactive.');
      }
      return;
    }

    // Step 2 — verify the OTP code
    try {
      const success = await verifyOtp(email, otp);
      if (success) {
        onNavigate('dashboard');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registrationType === 'client') {
      if (adminData.password !== adminData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      // Validate against the same rules the backend enforces, so users get
      // an inline message instead of a 400 from the API.
      try {
        clientAdminSchema.parse(adminData);
      } catch (err: unknown) {
        const zodErr = err as { errors?: Array<{ message: string }> };
        setError(zodErr.errors?.[0]?.message || 'Validation failed');
        return;
      }
      if (botCheck.answer !== botCheck.expected) {
        setError('Bot check failed. Please try again.');
        return;
      }
      
      if (!showRegOTP) {
        // Step 1: Send the real OTP email before showing the code input
        try {
          await authApi.sendRegistrationOtp(adminData.email);
          setShowRegOTP(true);
          setError('');
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to send verification code. Please try again.');
        }
        return;
      }
      
      // Step 2: Verify the OTP code the user entered
      try {
        await authApi.verifyRegistrationOtp(adminData.email, otp);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invalid or expired code.');
        return;
      }

      try {
        const success = await registerTenant({...tenantData, businessReqs, verificationDocs: { ...verificationDocs, uploadedAt: new Date().toISOString() }}, adminData);
        if (success) {
          toast.success('Registration successful! Setup/Onboarding info has been sent to your email. Please wait for System Admin approval.');
          onNavigate('login');
        } else {
          setError('Registration failed. Please try again or contact support.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred during registration.');
      }
    } else {
      // Guest Registration
      try {
        guestSchema.parse(guestData);
      } catch (err: unknown) {
        const zodErr = err as { errors?: Array<{message: string}> }; setError(zodErr.errors?.[0]?.message || 'Validation failed');
        return;
      }
      
      try {
        const success = await registerGuestAccount(guestData);
        if (success) {
          toast.success('Guest Sandbox created successfully!');
          onNavigate('login');
        } else {
          setError('Registration failed. Please try again or contact support.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred during registration.');
      }
    }
  };

  // ── Forgot password handlers ──────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!forgotEmail) { setError('Please enter your email address.'); return; }
    const ok = await requestPasswordReset(forgotEmail);
    if (ok) {
      setAuthView('forgot-sent');
    } else {
      setError('Something went wrong. Please try again.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (resetPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (resetPassword !== resetConfirm) { setError('Passwords do not match.'); return; }
    const ok = await confirmPasswordReset(resetToken, resetPassword);
    if (ok) {
      setResetSuccess(true);
    } else {
      setError('This reset link is invalid or has expired. Please request a new one.');
    }
  };

  if (mode === 'login') {
    // ── Reset password view (arrived via email link) ──────────────
    if (authView === 'reset') {
      return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="w-full max-w-md bg-blue-50 dark:bg-[#0A1931]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
            <div className="flex flex-col items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-[#0A6EFF] to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(10,110,255,0.3)]">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {resetSuccess ? 'Password updated' : 'Set new password'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center">
                {resetSuccess ? 'Your password has been reset successfully.' : 'Enter your new password below.'}
              </p>
            </div>

            {resetSuccess ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm text-center">
                  ✓ You can now log in with your new password.
                </div>
                <button
                  onClick={() => { setAuthView('login'); setResetSuccess(false); }}
                  className="w-full bg-[#0A6EFF] text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span><p>{error}</p>
                  </div>
                )}
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
                    <input
                      id="new-password"
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors"
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors"
                      required
                      placeholder="Repeat new password"
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#0A6EFF] text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                    Reset Password
                  </button>
                  <button type="button" onClick={() => setAuthView('login')} className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-center transition-colors">
                    Back to Login
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      );
    }

    // ── Forgot password — email sent confirmation ─────────────────
    if (authView === 'forgot-sent') {
      return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="w-full max-w-md bg-blue-50 dark:bg-[#0A1931]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="text-emerald-400" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Check your email</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
              If <span className="text-slate-700 dark:text-slate-300 font-medium">{forgotEmail}</span> is registered,
              you'll receive a password reset link shortly. Check your spam folder if it doesn't arrive.
            </p>
            <button
              onClick={() => setAuthView('login')}
              className="w-full bg-[#0A6EFF] text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    // ── Forgot password — email input form ────────────────────────
    if (authView === 'forgot') {
      return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="w-full max-w-md bg-blue-50 dark:bg-[#0A1931]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
            <button onClick={() => { setAuthView('login'); setError(''); }} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 flex items-center gap-2 text-sm transition-colors w-fit">
              <ArrowLeft size={16} /> Back to Login
            </button>
            <div className="flex flex-col items-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-[#0A6EFF] to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(10,110,255,0.3)]">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Forgot password?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center">
                Enter your email and we'll send you a reset link.
              </p>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start gap-2">
                <span className="mt-0.5">⚠️</span><p>{error}</p>
              </div>
            )}
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors"
                  required
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
              <button type="submit" className="w-full bg-[#0A6EFF] text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                Send Reset Link
              </button>
            </form>
          </div>
        </div>
      );
    }

    // ── Default login view ────────────────────────────────────────
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-blue-50 dark:bg-[#0A1931]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
          <button onClick={() => onNavigate('landing')} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 flex items-center gap-2 text-sm transition-colors w-fit">
            <ArrowLeft size={16} /> Back to Home
          </button>

          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[#0A6EFF] to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(10,110,255,0.3)]">
              <span className="text-slate-900 dark:text-white font-bold text-xl">L</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Sign in to your LeadCRM account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start gap-2">
              <div className="mt-0.5">⚠️</div>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {!showOTP ? (
              <>
                {/* ── Demo Accounts Quick Fill ───────────────────────── */}
                <div className="mb-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Demo Accounts (Click to fill)</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setEmail('admin@gmail.com'); setPassword('admin123'); }} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors">System Admin</button>
                    <button type="button" onClick={() => { setEmail('admin@democorp.com'); setPassword('admin123'); }} className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors">Client Admin</button>
                    <button type="button" onClick={() => { setEmail('bob@democorp.com'); setPassword('admin123'); }} className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors">Sales Rep</button>
                    <button type="button" onClick={() => { setEmail('guest@democorp.com'); setPassword('guest123'); }} className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2.5 py-1.5 rounded hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors">Guest Sandbox</button>
                  </div>
                </div>

                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors"
                    required
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(email); setError(''); setAuthView('forgot'); }}
                      className="text-xs text-[#0A6EFF] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors"
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-[#0A6EFF] text-slate-900 dark:text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors mt-4 shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                  Send OTP
                </button>
              </>
            ) : (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">
                  A 6-digit verification code was sent to <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>. Check your inbox.
                </div>
                <div>
                  <label htmlFor="otp-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Verification Code</label>
                  <input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors text-center text-lg tracking-widest"
                    required
                    maxLength={6}
                    placeholder="000000"
                    autoFocus
                  />
                </div>
                {/* Resend OTP */}
                <ResendOtpButton email={email} password={password} onResend={async () => { await login(email, password); }} />
                <button type="submit" className="w-full bg-[#0A6EFF] text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors mt-4 shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                  Verify & Sign In
                </button>
                <button type="button" onClick={() => { setShowOTP(false); setOtp(''); setError(''); }} className="w-full mt-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-center transition-colors">
                  Back to Login
                </button>
              </div>
            )}
          </form>

          {/* ── Google Sign-In ─────────────────────────────────────── */}
          {!showOTP && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200 dark:border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-blue-50 dark:bg-[#0A1931] text-xs text-slate-400 dark:text-slate-500 font-medium">
                    or
                  </span>
                </div>
              </div>
              <GoogleSignInButton onClick={loginWithGoogle} />
            </>
          )}

          <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account? <button onClick={() => onNavigate('register')} className="text-[#0A6EFF] font-medium hover:underline ml-1">Register</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-2xl bg-blue-50 dark:bg-[#0A1931]/90 backdrop-blur-xl p-8 sm:p-10 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
        <button onClick={() => onNavigate('landing')} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 flex items-center gap-2 text-sm transition-colors w-fit">
          <ArrowLeft size={16} /> Back to Home
        </button>
        
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {step === 0 ? 'Choose Account Type' : 'Create your account'}
          </h2>
          {step > 0 && registrationType === 'client' && (
            <div className="flex items-center gap-3">
              <p className="text-slate-500 dark:text-slate-400">Step {step} of 5</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-[#0A6EFF]' : 'bg-white dark:bg-slate-800'}`}></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start gap-2">
            <div className="mt-0.5">⚠️</div>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={(e) => {
          e.preventDefault();
          if (step === 0) {
            setStep(1);
          } else if (registrationType === 'client' && step < 5) {
            setStep(step + 1);
          } else {
            handleRegister(e);
          }
        }}>
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRegistrationType('client')}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${registrationType === 'client' ? 'border-[#0A6EFF] bg-blue-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-400/50'}`}
                >
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Client Admin</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Full tenant setup with document verification and approval flow.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRegistrationType('guest')}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${registrationType === 'guest' ? 'border-[#0A6EFF] bg-blue-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-400/50'}`}
                >
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Guest Demo</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Instant access to a seeded sandbox environment for testing.</p>
                </button>
              </div>

              {/* ── Google Sign-Up ─────────────────────────────────── */}
              <div className="relative mt-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200 dark:border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-blue-50 dark:bg-[#0A1931]/90 text-xs text-slate-400 dark:text-slate-500 font-medium">
                    or sign up with
                  </span>
                </div>
              </div>
              <GoogleSignInButton onClick={loginWithGoogle} label="Continue with Google" />
            </div>
          )}

          {step === 1 && registrationType === 'guest' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                  <input required value={guestData.firstName} onChange={e => setGuestData({...guestData, firstName: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="John" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                  <input required value={guestData.lastName} onChange={e => setGuestData({...guestData, lastName: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="Doe" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input type="email" required value={guestData.email} onChange={e => setGuestData({...guestData, email: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="guest@example.com" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input type="password" required value={guestData.password} onChange={e => setGuestData({...guestData, password: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                  <input type="password" required value={guestData.confirmPassword} onChange={e => setGuestData({...guestData, confirmPassword: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && registrationType === 'client' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">1</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Basic Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company Name</label>
                  <input required value={tenantData.companyName} onChange={e => setTenantData({...tenantData, companyName: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="e.g. Acme Corp" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Industry</label>
                  <select value={tenantData.industry} onChange={e => setTenantData({...tenantData, industry: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors">
                    <option>IT Solutions</option>
                    <option>Software Development</option>
                    <option>Consulting</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company Size</label>
                  <select value={tenantData.size} onChange={e => setTenantData({...tenantData, size: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors">
                    <option>1-10</option>
                    <option>11-50</option>
                    <option>51-200</option>
                    <option>201+</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Business Email</label>
                  <input type="email" required value={tenantData.businessEmail} onChange={e => setTenantData({...tenantData, businessEmail: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="hello@democorp.com" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && registrationType === 'client' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">2</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Business Requirements</h3>
              </div>
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Describe your business requirements</label>
                  <textarea 
                    required 
                    rows={4}
                    value={businessReqs.requirements} 
                    onChange={e => setBusinessReqs({...businessReqs, requirements: e.target.value})} 
                    className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors resize-none" 
                    placeholder="Tell us about the modules you need, your workflow, and any specific customizations..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Business Documents (Optional)</label>
                  <div className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 border-dashed rounded-lg px-4 py-8 text-center hover:border-[#0A6EFF] transition-all group relative">
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-slate-700 group-hover:border-blue-500/30 transition-colors">
                        <CheckCircle2 className={`w-6 h-6 ${businessReqs.documentName ? 'text-green-400' : 'text-slate-500'}`} />
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-1">
                        {businessReqs.documentName ? 'Document Selected' : 'Upload Business Registration'}
                      </p>
                      <p className="text-xs text-slate-500 mb-4">PDF, JPG, or PNG (Max 5MB)</p>
                      <input 
                        type="file" 
                        className="hidden" 
                        id="file-upload"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setBusinessReqs({...businessReqs, documentName: e.target.files[0].name});
                          }
                        }}
                      />
                      <label htmlFor="file-upload" className="inline-block px-6 py-2 bg-[#0A6EFF]/10 hover:bg-[#0A6EFF]/20 text-[#0A6EFF] rounded-xl text-sm font-bold cursor-pointer transition-all border border-[#0A6EFF]/20">
                        {businessReqs.documentName ? businessReqs.documentName : 'Select File'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                <p className="text-xs text-blue-400 leading-relaxed">
                  <strong>Note:</strong> Upon approval of your basic details, a <strong>Sandbox Environment</strong> will be automatically provisioned for your initial setup and testing.
                </p>
              </div>
            </div>
          )}

          {step === 3 && registrationType === 'client' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">3</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Legitimacy Verification</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">To secure our platform, please upload the following documents to verify your business legitimacy.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Business Permit / License</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="permit-upload"
                      onChange={(e) => e.target.files && setVerificationDocs({...verificationDocs, businessPermit: e.target.files[0].name})}
                    />
                    <label htmlFor="permit-upload" className="flex-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-[#0A6EFF] transition-colors truncate">
                      {verificationDocs.businessPermit || 'Select File...'}
                    </label>
                    {verificationDocs.businessPermit && <CheckCircle2 className="text-green-400" size={20} />}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tax Identification Number (TIN) Document</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="tin-upload"
                      onChange={(e) => e.target.files && setVerificationDocs({...verificationDocs, taxId: e.target.files[0].name})}
                    />
                    <label htmlFor="tin-upload" className="flex-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-[#0A6EFF] transition-colors truncate">
                      {verificationDocs.taxId || 'Select File...'}
                    </label>
                    {verificationDocs.taxId && <CheckCircle2 className="text-green-400" size={20} />}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Owner's Valid Government ID</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="id-upload"
                      onChange={(e) => e.target.files && setVerificationDocs({...verificationDocs, validId: e.target.files[0].name})}
                    />
                    <label htmlFor="id-upload" className="flex-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-[#0A6EFF] transition-colors truncate">
                      {verificationDocs.validId || 'Select File...'}
                    </label>
                    {verificationDocs.validId && <CheckCircle2 className="text-green-400" size={20} />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && registrationType === 'client' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">4</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Admin User Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                  <input required value={adminData.firstName} onChange={e => setAdminData({...adminData, firstName: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="Jane" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                  <input required value={adminData.lastName} onChange={e => setAdminData({...adminData, lastName: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="Doe" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Admin Email</label>
                  <input type="email" required value={adminData.email} onChange={e => setAdminData({...adminData, email: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="jane.doe@democorp.com" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input type="password" required value={adminData.password} onChange={e => setAdminData({...adminData, password: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                  <input type="password" required value={adminData.confirmPassword} onChange={e => setAdminData({...adminData, confirmPassword: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && registrationType === 'client' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">5</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Confirmation & Security</h3>
              </div>
              
              <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Company</span>
                  <span className="text-slate-900 dark:text-white font-medium">{tenantData.companyName || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Verification Status</span>
                  <span className="text-green-400 font-medium text-sm flex items-center gap-1">
                    <CheckCircle2 size={14} /> Documents Ready
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Admin Email</span>
                  <span className="text-slate-900 dark:text-white font-medium">{adminData.email || 'Not provided'}</span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800/30 rounded-xl border border-gray-200 dark:border-slate-700/50">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bot Check: {(botCheck as any).question}</label>
                <input 
                  type="text" 
                  required 
                  value={botCheck.answer} 
                  onChange={e => setBotCheck({...botCheck, answer: e.target.value})} 
                  className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" 
                  placeholder="Enter answer"
                />
              </div>

              {!showRegOTP ? (
                <>
                  <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer p-4 bg-white dark:bg-slate-950/50 rounded-xl border border-slate-800/50 hover:border-gray-200 dark:hover:border-slate-700 transition-colors">
                    <div className="mt-0.5">
                      <input type="checkbox" required className="rounded border-gray-200 dark:border-slate-700 bg-blue-50 dark:bg-[#0A1931] text-[#0A6EFF] focus:ring-[#0A6EFF] w-4 h-4" />
                    </div>
                    <span>I agree to the <a href="#" className="text-[#0A6EFF] hover:underline">Terms of Service</a> and <a href="#" className="text-[#0A6EFF] hover:underline">Privacy Policy</a>. I understand that my account requires approval from a System Administrator. Once approved, my <strong>Sandbox Environment</strong> will be created first for secure testing, followed by a <strong>Production Environment</strong> after review.</span>
                  </label>
                </>
              ) : (
                <div className="p-4 bg-white dark:bg-slate-950/50 rounded-xl border border-slate-800/50 text-center animate-in fade-in slide-in-from-right-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Email Verification</h4>
                  <p className="text-xs text-slate-500 mb-4">We sent a verification code to <strong>{adminData.email}</strong>. Please check your inbox.</p>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 text-left">Enter OTP</label>
                  <input 
                    type="text" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors text-center tracking-widest text-lg"
                    required
                    maxLength={6}
                    placeholder="------"
                  />
                  <div className="mt-3">
                    <ResendOtpButton
                      email={adminData.email}
                      password={adminData.password}
                      onResend={async () => {
                        // Re-send the registration OTP via the real API
                        await authApi.sendRegistrationOtp(adminData.email);
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => setShowRegOTP(false)} className="w-full mt-3 text-xs text-slate-500 hover:text-slate-300">
                    Go Back
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-10 pt-6 border-t border-slate-800/50">
            {step > 0 && !showRegOTP ? (
              <button type="button" onClick={() => setStep(step - 1)} className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors">Back</button>
            ) : <div></div>}
            <button 
              type="submit" 
              disabled={step === 0 && !registrationType}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)] ${step === 0 && !registrationType ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-[#0A6EFF] text-slate-900 dark:text-white hover:bg-blue-600'}`}
            >
              {step === 0 ? 'Next' : (registrationType === 'guest' ? 'Create Sandbox' : (step === 5 ? (showRegOTP ? 'Verify & Complete' : 'Send OTP & Complete') : 'Next Step'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
