'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/shared/services/auth.api';

const RESEND_COOLDOWN = 30;

interface EmailVerificationPageProps {
  email: string;
  onNavigate: (path: string) => void;
}

export default function EmailVerificationPage({ email, onNavigate }: EmailVerificationPageProps): React.ReactElement {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = useCallback(async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    setError('');
    try {
      await authApi.sendRegistrationOtp(email);
      toast.success(`New verification code sent to ${email}`);
      setCountdown(RESEND_COOLDOWN);
      setCanResend(false);
    } catch {
      toast.error('Failed to resend code. Please try again.');
      setError('Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  }, [canResend, isResending, email]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await authApi.verifyRegistrationOtp(email, code);
      if (response?.success) {
        setVerificationSuccess(true);
        toast.success('Email verified successfully!');
        setTimeout(() => {
          onNavigate('login');
        }, 2000);
      } else {
        setError('Invalid or expired verification code.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError('');
  };

  if (verificationSuccess) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xl text-center">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={40} />
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Email Verified!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
            Your email has been successfully verified. You can now log in to your account.
          </p>
          <div className="text-sm text-slate-400 dark:text-slate-500">
            Redirecting to login...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Blue gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-blue-600 via-blue-700 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-300 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity w-fit"
          >
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <img src="/leadcrm_logo.png" alt="LeadCRM Logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-xl font-bold">LeadCRM</span>
          </button>
          <div className="space-y-6">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6">
              <Mail className="text-white" size={32} />
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Check Your Email
            </h1>
            <p className="text-blue-100 text-lg max-w-md">
              We&apos;ve sent a 6-digit verification code to your email. Enter it below to activate your account.
            </p>
          </div>
          <div></div>
        </div>
      </div>

      {/* Right side - Verification form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-950">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Verify Your Email
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="w-full h-14 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 text-slate-900 dark:text-white text-center text-2xl tracking-[0.5em] font-semibold placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-center gap-1.5 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Didn&apos;t receive it?</span>
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors disabled:opacity-50"
                >
                  {isResending ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                  ) : (
                    'Resend code'
                  )}
                </button>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 tabular-nums">
                  Resend in <span className="text-slate-600 dark:text-slate-300 font-semibold">{countdown}s</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isVerifying ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Wrong email?{' '}
            <button
              onClick={() => onNavigate('register')}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold transition-colors"
            >
              Go back
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
