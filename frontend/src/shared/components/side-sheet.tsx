'use client';
import { panelThemeClass, panelHeaderClass, panelTitleClass, panelCloseClass } from '@/shared/components/side-panel-styles';

import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ModalCloseButton } from '@/shared/components/ui/modal-close-button';

interface SideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}

export function SideSheet({ isOpen, onClose, title, subtitle, children, width = 'w-full max-w-lg md:max-w-xl' }: SideSheetProps) {
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

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-200"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-y-0 right-0 h-dvh ${width} ${panelThemeClass} shadow-2xl z-210 flex flex-col border-l border-gray-200 dark:border-white/10`}
          >
            {/* Header */}
            <div className={panelHeaderClass + " flex items-center justify-between gap-3"}>
              <div className="min-w-0">
                <h2 className={panelTitleClass}>{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
              </div>
              <ModalCloseButton onClose={onClose} ariaLabel="Close sheet" size={20} className={panelCloseClass + " grid place-items-center"} />
            </div>

            {/* Body Container */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(content, document.body);
}
