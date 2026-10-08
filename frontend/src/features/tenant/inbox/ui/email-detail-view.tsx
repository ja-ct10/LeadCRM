'use client';

import React, { useState } from 'react';
import { ArrowLeft, Reply, Forward, Trash2, Archive, Loader2, Send } from 'lucide-react';
import ComposeModal from './compose-modal';
import { archiveGmailEmails, trashGmailEmails, type GmailEmail } from '../services/gmail.service';
import { safeMailboxHtml as sanitizeEmailHtml } from '../services/email-html';


interface EmailDetailViewProps {
  email: GmailEmail;
  onBack: () => void;
  onEmailsChanged: () => void;
}

function extractName(from: string): string {
  const match = from.match(/^(.+?)\s*<.+>$/);
  return match ? match[1].trim() : from.split('@')[0];
}

function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from;
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EmailDetailView({ email, onBack, onEmailsChanged }: EmailDetailViewProps): React.ReactElement {
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string; replyToMessageId?: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const handleReply = () => setDraft({ to: email.direction === 'outbound' ? extractEmail(email.to[0] ?? '') : extractEmail(email.from), subject: /^re:/i.test(email.subject) ? email.subject : 'Re: ' + email.subject, body: '', replyToMessageId: email.id });
  const handleForward = () => {
    const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    setDraft({ to: '', subject: 'Fwd: ' + email.subject, body: '<p><br></p><p>---------- Forwarded message ----------<br>From: ' + escape(email.from) + '<br>Date: ' + escape(formatFullDate(email.date)) + '<br>Subject: ' + escape(email.subject) + '<br>To: ' + escape(email.to.join(', ')) + '</p>' + sanitizeEmailHtml(email.body) });
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-col h-full">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-2 sm:gap-2 sm:px-6 sm:py-3 border-b border-gray-100 dark:border-white/5 shrink-0">
        <button
          onClick={onBack}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <button
          onClick={handleReply}
          className="inline-flex items-center gap-1 px-2 py-2 sm:px-3 rounded-lg border border-gray-200 dark:border-white/8 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Reply"
        >
          <Reply className="w-3.5 h-3.5" />
          <span>Reply</span>
        </button>
        <button
          onClick={handleForward}
          className="inline-flex items-center gap-1 px-2 py-2 sm:px-3 rounded-lg border border-gray-200 dark:border-white/8 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Forward"
        >
          <Forward className="w-3.5 h-3.5" />
          <span>Forward</span>
        </button>
        <button
          onClick={() => void archiveGmailEmails([email.id]).then(onEmailsChanged).catch(error => setSendError(error.message))}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Archive"
        >
          <Archive className="w-4 h-4" />
        </button>
        <button
          onClick={() => void trashGmailEmails([email.id]).then(onEmailsChanged).catch(error => setSendError(error.message))}
          className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Email content */}
      <div className="min-w-0 flex-1 overflow-auto break-words px-3 py-5 sm:px-6">
        {sendError && <p role="alert" className="mb-3 text-sm text-red-600">{sendError}</p>}
        {/* Subject */}
        <h2 className="break-words [overflow-wrap:anywhere] text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {email.subject || '(no subject)'}
        </h2>

        {/* Sender info */}
        <div className="flex items-start gap-3 mb-6">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {extractName(email.from).charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 break-all">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {extractName(email.from)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                &lt;{extractEmail(email.from)}&gt;
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 mt-0.5 [overflow-wrap:anywhere]">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                to {email.to.length > 0 ? email.to.join(', ') : 'me'}
              </span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 block">
              {formatFullDate(email.date)}
            </span>
          </div>
        </div>

        {/* Email body */}
        <div
          className="prose prose-sm dark:prose-invert min-w-0 max-w-none overflow-x-auto [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap [&_table]:max-w-full text-slate-700 dark:text-slate-300 text-[13px] leading-relaxed [&_a]:text-blue-500 [&_img]:max-w-full [&_img]:rounded-md"
          dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.body || '<p style="color:#94a3b8">(No content)</p>') }}
        />
      </div>

      {/* Bottom action bar when reply panel is closed */}
      {(
        <div className="flex items-center gap-2 px-3 py-3 sm:px-6 border-t border-gray-100 dark:border-white/5 shrink-0">
          <button
            onClick={handleReply}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 dark:border-white/8 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Reply"
          >
            <Reply className="w-4 h-4" />
            <span>Reply</span>
          </button>
          <button
            onClick={handleForward}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 dark:border-white/8 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Forward"
          >
            <Forward className="w-4 h-4" />
            <span>Forward</span>
          </button>
        </div>
      )}
      <ComposeModal isOpen={!!draft} initialDraft={draft} onClose={() => setDraft(null)} onSent={onEmailsChanged} />
    </div>
  );
}
