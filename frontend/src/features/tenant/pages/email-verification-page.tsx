'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/shared/services/auth.api';

const RESEND_COOLDOWN = 60;

interface EmailVerificationPageProps {
  email: string;
  error?: string;
  onNavigate: (path: string) => void;
}

export default function EmailVerificationPage({ email, error, onNavigate }: EmailVerificationPageProps): React.ReactElement {
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Handle magic link error states from URL params
  useEffect(() => {
    if (error === 'expired') {
      setErrorMessage('Your verification link has expired. Please request a new one.');
      setCanResend(true);
      setCountdown(0);
    } else if (error === 'invalid') {
      setErrorMessage('This verification link is invalid or has already been used.');
    }
  }, [error]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = useCallback(async () => {
    if (!canResend || isResending || !email) return;
    setIsResending(true);
    setErrorMessage('');
    try {
      await authApi.resendVerification(email);
      toast.success('New verification email sent. Check your inbox.');
      setCountdown(RESEND_COOLDOWN);
      setCanResend(false);
    } catch {
      toast.error('Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  }, [canResend, isResending, email]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (code.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit code.');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await authApi.verifyRegistrationOtp(email, code);
      if (response?.success) {
        setVerificationSuccess(true);
        toast.success('Email verified successfully!');
        // Auto-login: the backend set the cookie in the response
        // Redirect to onboarding — AuthContext will hydrate on next page load
        setTimeout(() => {
          onNavigate('onboarding');
        }, 1500);
      } else {
        setErrorMessage('Invalid or expired verification code.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (errorMessage) setErrorMessage('');
    // Auto-submit when 6 digits entered
    if (digits.length === 6 && !isVerifying) {
      setTimeout(() => {
        const form = document.getElementById('otp-form') as HTMLFormElement;
        form?.requestSubmit();
      }, 100);
    }
  };

  // Success state
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
            Your email has been verified successfully. Setting up your workspace...
          </p>
          <div className="text-sm text-slate-400 dark:text-slate-500">
            Redirecting to onboarding...
          </div>
        </div>
      </div>
    );
  }

  // Error state (invalid link — no email available for resend)
  if (error === 'invalid' && !email) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xl text-center">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-600 dark:text-red-400" size={40} />
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Invalid Verification Link
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
            This link is invalid or has already been used. Please try logging in or registering again.
          </p>
          <button
            onClick={() => onNavigate('login')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Go to Login
          </button>
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
              <Mail size={32} className="text-white/80" />
            </div>
            <h2 className="text-3xl font-bold leading-tight">
              Check your inbox
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed max-w-md">
              We sent a verification email with a magic link and a 6-digit code. Use either to verify your account.
            </p>
          </div>
          <div className="text-sm text-blue-200/60">
            Secure email verification powered by LeadCRM
          </div>
        </div>
      </div>

      {/* Right side - Verification form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-slate-950">
        <div className="w-full max-w-md">
          {/* Back button */}
          <button
            onClick={() => onNavigate('register')}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mb-8 transition-colors"
          >
            <ArrowLeft size={16} />
            Wrong email? Go back
          </button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Verify your email
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              We sent a verification email to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>.
              Click the link in the email, or enter the 6-digit code below.
            </p>
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
            </div>
          )}

          {/* OTP Form */}
          <form id="otp-form" onSubmit={handleVerify} className="space-y-6">
            <div>
              <label htmlFor="otp-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Verification Code
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="w-full h-14 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 text-slate-900 dark:text-white text-center text-2xl tracking-[0.5em] font-semibold placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="000000"
                maxLength={6}
                required
                aria-label="6-digit verification code"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          {/* Resend section */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Didn&apos;t receive the email?
            </p>
            {canResend ? (
              <button
                onClick={handleResend}
                disabled={isResending}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Resend verification email'}
              </button>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Resend available in <span className="font-semibold text-slate-600 dark:text-slate-300">{countdown}s</span>
              </p>
            )}
          </div>

          {/* Help text */}
          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold">Tip:</span> Check your spam/junk folder if you don&apos;t see the email.
              The verification link expires in 24 hours, and the code expires in 10 minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
