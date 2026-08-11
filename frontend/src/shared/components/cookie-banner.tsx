'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, X } from 'lucide-react';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
}

interface CookieBannerProps {
  onNavigate?: (path: string) => void;
}

export function CookieBanner({ onNavigate }: CookieBannerProps) {
  const [showBanner, setShowBanner] = useState(true); // Changed to true for testing
  const [showManage, setShowManage] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
  });

  // Comment out the useEffect to always show banner for testing
  // useEffect(() => {
  //   // Always show banner on first load if no preferences saved
  //   const savedPreferences = localStorage.getItem('leadcrm_cookie_preferences');
  //   if (!savedPreferences) {
  //     // Small delay for smooth entrance animation
  //     setTimeout(() => setShowBanner(true), 500);
  //   }
  // }, []);

  const handleClose = () => {
    // Close without saving - treat as "Decline"
    const declined = { necessary: true, analytics: false };
    localStorage.setItem('leadcrm_cookie_preferences', JSON.stringify(declined));
    setShowBanner(false);
  };

  const handleAcceptAll = () => {
    const allAccepted = { necessary: true, analytics: true };
    localStorage.setItem('leadcrm_cookie_preferences', JSON.stringify(allAccepted));
    setShowBanner(false);
  };

  const handleDecline = () => {
    const declined = { necessary: true, analytics: false };
    localStorage.setItem('leadcrm_cookie_preferences', JSON.stringify(declined));
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('leadcrm_cookie_preferences', JSON.stringify(preferences));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-6xl"
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Cookie className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Cookie preferences
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                We use cookies to improve your experience and understand how our product is used. Read our{' '}
                <a 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate?.('privacy-policy');
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                >
                  Privacy Policy
                </a>{' '}
                for more details.
              </p>
            </div>

            {/* Close button - always visible */}
            <button
              onClick={handleClose}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close cookie banner"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Buttons - only show when not in manage mode */}
          {!showManage && (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowManage(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Manage
              </button>
              <button
                onClick={handleDecline}
                className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-6 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg shadow-blue-600/30"
              >
                Accept all
              </button>
            </div>
          )}

          {/* Manage Cookie Preferences */}
          <AnimatePresence>
            {showManage && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-6">
                  {/* Necessary Cookies */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Necessary
                      </h4>
                      <div className="relative inline-block w-12 h-6 rounded-full bg-blue-600 cursor-not-allowed opacity-50">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transform translate-x-6 transition-transform" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Required for the site to function and cannot be disabled.
                    </p>
                  </div>

                  {/* Analytics Cookies */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Analytics
                      </h4>
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                        className={`relative inline-block w-12 h-6 rounded-full transition-colors ${
                          preferences.analytics ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div
                          className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            preferences.analytics ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Helps us understand how visitors interact with the product.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowManage(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePreferences}
                    className="px-6 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg shadow-blue-600/30"
                  >
                    Save preferences
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
