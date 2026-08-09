import React from 'react';
import { Send } from 'lucide-react';

interface LeadSmsTabProps {
  smsText: string;
  isSending: boolean;
  onSmsTextChange: (value: string) => void;
  onSend: (e: React.FormEvent) => void;
}

export function LeadSmsTab({
  smsText,
  isSending,
  onSmsTextChange,
  onSend,
}: LeadSmsTabProps) {
  return (
    <div className="space-y-4 text-left animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#040914] border border-gray-200 dark:border-white/[0.04] rounded-2xl max-w-sm mx-auto shadow-inner overflow-hidden">
        <div className="bg-slate-100 dark:bg-white/[0.02] p-3 text-center border-b border-gray-200 dark:border-white/5 text-[11px] font-bold tracking-wider uppercase text-slate-500">
          📲 Outbound Telephony Sim
        </div>

        {/* Mock chat thread */}
        <div className="p-4 space-y-4 h-48 overflow-y-auto custom-scrollbar flex flex-col justify-end text-xs">
          <div className="bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-300 p-2.5 rounded-2xl self-start max-w-[80%] text-left">
            Hi! We received your site checkup inquiry.
          </div>
          <div className="bg-blue-500 text-white p-2.5 rounded-2xl self-end max-w-[80%] text-left shadow-sm">
            Great! I will meet the representative technicians at the site.
          </div>
        </div>

        {/* Input row */}
        <form onSubmit={onSend} className="p-3 border-t border-gray-200 dark:border-white/5 flex gap-2">
          <input
            type="text"
            required
            placeholder="Type SMS texts..."
            value={smsText}
            onChange={e => onSmsTextChange(e.target.value)}
            className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-full px-3.5 py-1 text-xs text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isSending}
            className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            <Send size={12} />
          </button>
        </form>
      </div>
    </div>
  );
}
