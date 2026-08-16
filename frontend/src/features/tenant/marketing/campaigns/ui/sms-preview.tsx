'use client';

import React from 'react';

interface SmsPreviewProps {
  content?: string;
}

function getSmsStats(text: string): { charCount: number; partCount: number } {
  const charCount = text.length;
  const partCount = charCount === 0 ? 1 : Math.ceil(charCount / 160);
  return { charCount, partCount };
}

export function SmsPreview({ content }: SmsPreviewProps): React.ReactElement {
  const hasContent = content && content.trim().length > 0;
  const { charCount, partCount } = getSmsStats(content ?? '');

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone frame */}
      <div className="relative w-56 rounded-[2rem] border-[5px] border-slate-800 dark:border-slate-600 bg-white dark:bg-[#0c0f16] shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-slate-800 dark:bg-slate-600 rounded-full z-10" aria-hidden="true" />

        {/* Screen content */}
        <div className="pt-8 pb-4 px-3 min-h-48 flex flex-col">
          <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 mb-4 font-medium">
            +639XXXXXXXXX · Today
          </div>

          <div className="flex flex-col flex-1">
            {hasContent ? (
              <p className="bg-emerald-500 text-white text-[11px] leading-relaxed rounded-2xl rounded-tr-sm px-3 py-2 self-end max-w-[90%] whitespace-pre-wrap break-words shadow-sm">
                {content}
              </p>
            ) : (
              <p className="bg-emerald-500 text-white/70 text-[11px] leading-relaxed rounded-2xl rounded-tr-sm px-3 py-2 self-end max-w-[90%] italic shadow-sm">
                Your SMS message will appear here...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Character / part counter */}
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
        {charCount} chars · {partCount} SMS part{partCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
