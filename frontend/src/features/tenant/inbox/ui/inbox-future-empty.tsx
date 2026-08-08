'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';

export default function InboxFutureEmpty(): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();

  const contentAnimation = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16">
      <motion.div {...contentAnimation} className="flex flex-col items-center text-center max-w-sm">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-500/10 border border-slate-500/20 mb-6">
          <Clock className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        </div>

        {/* Heading */}
        <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
          Nothing Scheduled Yet!
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Snooze items from your inbox and they&apos;ll show up here.
        </p>
      </motion.div>
    </div>
  );
}
