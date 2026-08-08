'use client';

import React from 'react';
import { X, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface FormPublishedModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string;
  embedCode: string;
}

export function FormPublishedModal({ isOpen, onClose, shareLink, embedCode }: FormPublishedModalProps): React.ReactElement {
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`)).catch(() => toast.error('Failed to copy'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Form Published!</h2>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Embed Code */}
            <div className="space-y-2 mb-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Embed Code</h3>
              <p className="text-xs text-slate-400">Copy and paste this code into your website to embed the form.</p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-300 break-all leading-relaxed select-all">
                {embedCode}
              </div>
              <button onClick={() => copy(embedCode, 'Embed code')}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <Copy size={13} /> Copy code
              </button>
            </div>

            <div className="h-px bg-gray-200 dark:bg-white/[0.06] mb-5" />

            {/* Share Link */}
            <div className="space-y-2 mb-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Share Link</h3>
              <p className="text-xs text-slate-400">Share this link to let anyone access your form directly (e.g., in emails or direct messages).</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate select-all">
                  {shareLink}
                </div>
                <button onClick={() => copy(shareLink, 'Share link')}
                  className="shrink-0 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
