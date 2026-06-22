import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface SlidingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}

export function SlidingDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-full max-w-lg md:max-w-xl'
}: SlidingDrawerProps) {
  // Lock body scrolling when the drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Handle ESC key press to close the drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            id="sliding-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] cursor-pointer"
          />

          {/* Sliding Drawer Container */}
          <motion.div
            id="sliding-drawer-container"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className={`fixed inset-y-0 right-0 h-full ${width} bg-white dark:bg-slate-900 shadow-[0_0_50px_0_rgba(0,0,0,0.15)] dark:shadow-[0_0_50px_0_rgba(0,0,0,0.3)] z-[110] flex flex-col border-l border-slate-200 dark:border-white/10`}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
              <div>
                {title ? (
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {title}
                  </h2>
                ) : (
                  <div className="h-6" /> // Placeholder spacing
                )}
                {subtitle && (
                  <p className="text-sm text-slate-500 mt-1 dark:text-slate-400 font-medium">
                    {subtitle}
                  </p>
                )}
              </div>
              
              <button
                id="sliding-drawer-close"
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-150 focus:ring-2 focus:ring-blue-500/20 outline-none"
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Drawer Body Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
