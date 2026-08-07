'use client';

import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { initiateGmailConnect } from '../services/gmail.service';

function GmailIcon(): React.ReactElement {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M22 6L12 13L2 6V4L12 11L22 4V6Z" fill="currentColor" opacity="0.9" />
      <path d="M2 4H22V20H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M2 4L12 13L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function InboxCurrentEmpty(): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [isConnecting, setIsConnecting] = useState(false);

  const contentAnimation = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

  const floatAnimation = shouldReduceMotion
    ? {}
    : { animate: { y: [0, -6, 0] }, transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const } };

  const handleConnect = async (): Promise<void> => {
    setIsConnecting(true);
    try {
      await initiateGmailConnect();
    } catch {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16">
      <motion.div {...contentAnimation} className="flex flex-col items-center text-center max-w-sm">
        {/* Icon */}
        <motion.div
          {...floatAnimation}
          className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6"
        >
          <Mail className="w-8 h-8 text-blue-500" />
        </motion.div>

        {/* Heading */}
        <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
          Never miss a customer conversation
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          Connect your Gmail account to keep every customer interaction in one place.
        </p>

        {/* Upcoming feature mention */}
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mb-8 max-w-xs">
          Upcoming feature: Two-way Gmail sync using the Gmail API, allowing automatic email syncing, conversation tracking, and sending emails directly from LeadCRM.
        </p>

        {/* CTA Button */}
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          aria-label="Open Emails"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GmailIcon />
          )}
          <span>{isConnecting ? 'Connecting...' : 'Open Emails'}</span>
        </button>
      </motion.div>
    </div>
  );
}
