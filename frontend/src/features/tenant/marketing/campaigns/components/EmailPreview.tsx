import React from 'react';
import { Mail, Shield, UserCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { sanitizeEmailHtml } from '@/src/lib/sanitize';

interface EmailPreviewProps {
  subject: string;
  from?: string;
  to?: string;
  htmlContent: string;
  className?: string;
}

export function EmailPreview({
  subject,
  from = 'youremail@gmail.com',
  to = 'recipient@example.com',
  htmlContent,
  className,
}: EmailPreviewProps) {
  // Sanitize HTML content to prevent XSS
  const safeHtmlContent = sanitizeEmailHtml(htmlContent);

  const senderName = from.split('@')[0];
  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={cn(
        'w-full max-w-2xl mx-auto flex flex-col bg-white dark:bg-slate-900',
        'border border-gray-200 dark:border-white/8 rounded-2xl shadow-xl overflow-hidden',
        className,
      )}
    >
      {/* ── macOS-style chrome bar ── */}
      <div className="bg-slate-100 dark:bg-white/4 px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-white/6">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-400 dark:bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-400 dark:bg-green-500/80" />
        </div>
        <div className="ml-4 text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Message Preview
        </div>
      </div>

      {/* ── Email header ── */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-slate-900 space-y-4">
        {/* Logo branding strip */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/leadcrm_logo.png"
            alt="LeadCRM"
            className="h-7 w-auto object-contain"
          />
          <div className="h-4 w-px bg-gray-200 dark:bg-white/8" />
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Email Preview
          </span>
        </div>

        {/* Subject */}
        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">
          {subject || 'No Subject'}
        </h2>

        {/* From / To / Time */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <UserCircle2 className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {senderName}{' '}
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  &lt;{from}&gt;
                </span>
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                to {to}
              </span>
            </div>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">{timeLabel}</span>
        </div>
      </div>

      {/* ── Email body ── */}
      <div className="p-6 bg-white dark:bg-slate-900 min-h-75">
        {htmlContent ? (
          <div
            className="prose prose-slate dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
          />
        ) : (
          <div className="flex flex-col h-full min-h-65 items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
            <Mail className="w-8 h-8 opacity-40" />
            <p className="text-sm">Your email preview will appear here</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-white/2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secure email delivered by LeadCRM</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          <span>Privacy Policy</span>
          <span>·</span>
          <span>Terms of Service</span>
        </div>
      </div>
    </div>
  );
}
