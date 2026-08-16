'use client';

import React from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { FormRecord } from '../types/form.types';

interface FormSharePanelProps {
  form: FormRecord;
  shareLink: string;
  embedCode: string;
}

export function FormSharePanel({ form, shareLink, embedCode }: FormSharePanelProps): React.ReactElement {
  const hasUnpublishedEdits = form.status === 'draft';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied to clipboard`)).catch(() => toast.error('Failed to copy'));
  };

  return (
    <div className="max-w-xl space-y-5">
      {hasUnpublishedEdits && (
        <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">This Form has unpublished edits. Publish it in order to see the latest changes.</p>
        </div>
      )}

      {/* Embed Code */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Embed Code</h3>
          <p className="text-xs text-slate-400 mt-0.5">Copy and paste this code into your website to embed the form.</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all leading-relaxed select-all">
          {embedCode}
        </div>
        <button onClick={() => copyToClipboard(embedCode, 'Embed code')}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
          <Copy size={13} /> Copy code
        </button>
      </div>

      {/* Share Link */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Share Link</h3>
          <p className="text-xs text-slate-400 mt-0.5">Share this link to let anyone access your form directly (e.g., in emails or direct messages).</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate select-all">
            {shareLink}
          </div>
          <button onClick={() => copyToClipboard(shareLink, 'Share link')}
            className="shrink-0 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            title="Copy share link">
            <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
