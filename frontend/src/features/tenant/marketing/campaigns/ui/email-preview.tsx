'use client';

import React from 'react';

interface EmailPreviewProps {
  subject?: string;
  content?: string;
}

export function EmailPreview({ subject, content }: EmailPreviewProps): React.ReactElement {
  const hasContent = content && content.trim().length > 0;
  const displaySubject = subject && subject.trim().length > 0 ? subject : 'No subject';

  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden shadow-md">
      {/* macOS-style header bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-white/3 border-b border-gray-200 dark:border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-amber-400" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-green-400" aria-hidden="true" />
        <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
          Message Preview
        </span>
      </div>

      {/* Email header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-12 shrink-0">Subject</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {displaySubject}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-12 shrink-0">From</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            Sender Name &lt;sender@yourdomain.com&gt;
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-12 shrink-0">To</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            Recipient Name &lt;recipient@example.com&gt;
          </span>
        </div>
      </div>

      {/* Email body */}
      <div className="px-5 py-4 min-h-32">
        {hasContent ? (
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">
            Your email preview will appear here...
          </p>
        )}
      </div>
    </div>
  );
}
