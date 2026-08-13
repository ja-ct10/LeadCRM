'use client';

import React from 'react';
import { Mail, Shield } from 'lucide-react';

interface EmailPreviewProps {
  subject?: string;
  content?: string;
}

export function EmailPreview({ subject, content }: EmailPreviewProps): React.ReactElement {
  const hasContent = content && content.trim().length > 0;
  const displaySubject = subject && subject.trim().length > 0 ? subject : 'No subject';

  return (
    <div className="w-full rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-slate-900 overflow-hidden shadow-lg">

      {/* ── macOS-style chrome bar ── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-white/4 border-b border-gray-200 dark:border-white/6">
        <span className="w-3 h-3 rounded-full bg-red-400" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-amber-400" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-green-400" aria-hidden="true" />
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Mail className="w-3.5 h-3.5" />
          Message Preview
        </span>
      </div>

      {/* ── Brand header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 space-y-4">
        {/* Logo row */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/leadcrm_logo.png"
            alt="LeadCRM"
            className="h-6 w-auto object-contain"
          />
          <div className="h-3.5 w-px bg-gray-200 dark:bg-white/8" />
          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Email Preview
          </span>
        </div>

        {/* Email metadata */}
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase w-14 shrink-0 tracking-wider">
              Subject
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {displaySubject}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase w-14 shrink-0 tracking-wider">
              From
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Sender Name &lt;sender@yourdomain.com&gt;
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase w-14 shrink-0 tracking-wider">
              To
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Recipient Name &lt;recipient@example.com&gt;
            </span>
          </div>
        </div>
      </div>

      {/* ── Email body ── */}
      <div className="px-5 py-5 min-h-32">
        {hasContent ? (
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-25 gap-2 text-slate-400 dark:text-slate-600">
            <Mail className="w-6 h-6 opacity-40" />
            <p className="text-xs italic">Your email preview will appear here...</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-white/2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <Shield className="w-3 h-3 text-emerald-500" />
          <span>Secure email delivered by LeadCRM</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
          <span>Privacy</span>
          <span>·</span>
          <span>Terms</span>
        </div>
      </div>
    </div>
  );
}
