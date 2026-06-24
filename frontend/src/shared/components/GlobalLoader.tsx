'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Shield } from 'lucide-react';

// Setup global tracking types
declare global {
  interface Window {
    startApiOperation: (id: string) => void;
    endApiOperation: (id: string) => void;
    executeMockApiCall: (ms: number) => Promise<any>;
  }
}

// Global active ops record to track outstanding timers and count
const activeOpsSet = new Map<string, NodeJS.Timeout>();
// Store original fetch outside the component so it's captured once
// and never changes across re-renders (avoids the infinite loop).
const _originalFetch = typeof window !== 'undefined' ? window.fetch : undefined;
let _fetchPatched = false;

export default function GlobalLoader() {
  const [showSpinner, setShowSpinner] = useState(false);
  const [ongoingCount, setOngoingCount] = useState(0);

  useEffect(() => {
    const startOp = (id: string) => {
      setOngoingCount(prev => prev + 1);
      const timer = setTimeout(() => {
        setShowSpinner(true);
      }, 1000);
      activeOpsSet.set(id, timer);
    };

    const endOp = (id: string) => {
      const timer = activeOpsSet.get(id);
      if (timer) {
        clearTimeout(timer);
        activeOpsSet.delete(id);
      }
      setOngoingCount(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setShowSpinner(false);
        }
        return next;
      });
    };

    window.startApiOperation = startOp;
    window.endApiOperation = endOp;

    window.executeMockApiCall = (ms: number) => {
      const fetchId = `fetch_mock_${Math.random().toString(36).substring(2, 11)}`;
      startOp(fetchId);
      return new Promise((resolve) => {
        setTimeout(() => {
          endOp(fetchId);
          resolve({ status: 'success', message: `Simulated response after ${ms}ms`, duration: ms });
        }, ms);
      });
    };

    // Only patch fetch once — prevents re-patching on every re-render
    if (!_fetchPatched && _originalFetch) {
      _fetchPatched = true;
      const customFetch = async function (...args: any[]) {
        const input = args[0];
        const requestUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : '';

        if (requestUrl.includes('/api/mock-slow-request')) {
          const urlParams = new URL(requestUrl, window.location.origin);
          const ms = parseInt(urlParams.searchParams.get('ms') || '1500', 10);
          return window.executeMockApiCall(ms);
        }

        const fetchId = `fetch_raw_${Math.random().toString(36).substring(2, 11)}`;
        startOp(fetchId);
        try {
          const response = await _originalFetch!(args[0], args[1]);
          return response;
        } finally {
          endOp(fetchId);
        }
      };

      try {
        Object.defineProperty(window, 'fetch', { value: customFetch, writable: true, configurable: true });
      } catch {
        window.fetch = customFetch;
      }
    }

    return () => {
      // Only cleanup timers — do not restore fetch here to avoid
      // the cleanup/reattach cycle that caused the infinite loop.
      activeOpsSet.forEach(timer => clearTimeout(timer));
      activeOpsSet.clear();
    };
  }, []); // empty deps — runs once on mount only

  return (
    <AnimatePresence>
      {showSpinner && (
        <motion.div
          id="global-loading-spinner-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-900/60 dark:bg-[#030712]/75 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 380 }}
            className="bg-white dark:bg-[#0b0f19] border border-gray-100 dark:border-white/[0.08] rounded-2xl p-8 max-w-xs w-full mx-4 shadow-2xl flex flex-col items-center space-y-4 text-center ring-1 ring-black/[0.03]"
          >
            {/* Elegant Double Ring Loading Wheel */}
            <div className="relative flex items-center justify-center h-16 w-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                className="w-12 h-12 rounded-full border-[3px] border-blue-500/10 border-t-blue-500"
              />
              <Loader2 className="absolute h-5 w-5 text-blue-500 animate-spin" />
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Processing Request
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Please wait while we securely fetch your data...
              </p>
            </div>

            {/* Design & Requirement Traceability Info */}
            <div className="w-full bg-slate-50 dark:bg-white/[0.02] rounded-lg py-2 px-3 border border-gray-100 dark:border-white/[0.04] flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-blue-400/80">
              <Shield size={11} className="text-blue-500" />
              <span>Secure Connection • LeadCRM</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
