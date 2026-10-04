'use client';
import { panelThemeClass, panelHeaderClass, panelTitleClass, panelCloseClass } from '@/shared/components/side-panel-styles';

import React, { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ModalCloseButton } from '@/shared/components/ui/modal-close-button';

interface SlidingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
  headerActions?: ReactNode;
}

export function SlidingDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-full max-w-lg md:max-w-xl',
  headerActions,
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
            className={`fixed inset-y-0 right-0 h-dvh ${width} ${panelThemeClass} shadow-[0_0_50px_0_rgba(0,0,0,0.15)] dark:shadow-[0_0_50px_0_rgba(0,0,0,0.3)] z-[110] flex flex-col border-l border-slate-200 dark:border-white/10`}
          >
            {/* Drawer Header */}
            <div className={panelHeaderClass + " flex items-center justify-between gap-3"}>
              <div className="min-w-0">
                {title ? (
                  <h2 className={panelTitleClass}>
                    {title}
                  </h2>
                ) : (
                  <div className="h-6" />
                )}
                {subtitle && (
                  <p className="text-sm text-slate-500 mt-1 dark:text-slate-400 font-medium">
                    {subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {headerActions}
                <ModalCloseButton onClose={onClose} ariaLabel="Close drawer" size={20} className={panelCloseClass + " grid place-items-center"} />
              </div>
            </div>

            {/* Scrollable Drawer Body Content */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
