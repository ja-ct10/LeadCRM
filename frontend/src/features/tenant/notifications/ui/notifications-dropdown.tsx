'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { 
  Mail, 
  TrendingUp, 
  AlertCircle, 
  DollarSign, 
  Calendar, 
  Users, 
  Clock, 
  X,
  ArrowRight
} from 'lucide-react';
import { useNotifications } from '../hooks/use-notifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

function getNotificationIcon(type: string) {
  const iconClass = "w-4 h-4 text-white";
  switch (type) {
    case 'campaign_sent':
    case 'email_sent':
      return { icon: <Mail className={iconClass} />, bg: 'bg-blue-500' };
    case 'open_rate_update':
    case 'engagement_alert':
      return { icon: <TrendingUp className={iconClass} />, bg: 'bg-emerald-500' };
    case 'budget_alert':
    case 'ad_budget_update':
      return { icon: <DollarSign className={iconClass} />, bg: 'bg-amber-500' };
    case 'scheduled_reminder':
      return { icon: <Calendar className={iconClass} />, bg: 'bg-blue-500' };
    case 'new_leads':
    case 'deal_assigned':
      return { icon: <Users className={iconClass} />, bg: 'bg-blue-500' };
    case 'listing_expiring':
    case 'task_due':
      return { icon: <Clock className={iconClass} />, bg: 'bg-amber-500' };
    case 'approval_pending':
    case 'workflow_failed':
      return { icon: <AlertCircle className={iconClass} />, bg: 'bg-red-500' };
    default:
      return { icon: <Mail className={iconClass} />, bg: 'bg-slate-500' };
  }
}

interface NotificationItemProps {
  id: string;
  type: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  onMarkRead: (id: string) => void;
}

function NotificationItem({ id, type, title, body, isRead, createdAt, onMarkRead }: NotificationItemProps) {
  const { icon, bg } = getNotificationIcon(type);
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <button
      onClick={() => !isRead && onMarkRead(id)}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left',
        isRead
          ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
          : 'bg-blue-50 dark:bg-blue-500/5 hover:bg-blue-100 dark:hover:bg-blue-500/10',
        'cursor-pointer'
      )}
    >
      {/* Icon */}
      <div className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center', bg)}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className={cn(
          'text-xs font-medium text-slate-900 dark:text-white mb-0.5 line-clamp-1',
          !isRead && 'font-semibold'
        )}>
          {title}
        </h3>
        {body && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-1">
            {body}
          </p>
        )}
        <p className="text-[10px] text-slate-500 dark:text-slate-500">
          {timeAgo}
        </p>
      </div>

      {/* Unread indicator */}
      {!isRead && (
        <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" aria-label="Unread notification" />
      )}
    </button>
  );
}

export default function NotificationsDropdown({ isOpen, onClose, triggerRef }: NotificationsDropdownProps) {
  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications();
  const shouldReduce = useReducedMotion();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, triggerRef]);

  // Return focus to trigger on close
  useEffect(() => {
    if (!isOpen) {
      triggerRef.current?.focus();
    }
  }, [isOpen, triggerRef]);

  const handleViewAll = () => {
    onClose();
    router.push('/notifications');
  };

  // Show only recent notifications (max 5)
  const recentNotifications = notifications.slice(0, 5);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            aria-hidden="true"
          />

          {/* Dropdown Panel */}
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.95, y: shouldReduce ? 0 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: shouldReduce ? 1 : 0.95, y: shouldReduce ? 0 : -8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, duration: 0.15 }}
            className="fixed right-4 top-16 z-50 w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
          >
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.05] shadow-2xl backdrop-blur-xl flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/[0.05]">
                <div>
                  <h2 
                    id="notifications-title"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Notifications
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    You have {unreadCount} notification{unreadCount !== 1 ? 's' : ''} today
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading && recentNotifications.length === 0 ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-start gap-3 p-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                          <div className="h-2 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Mail className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                      No notifications yet
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                      When you receive notifications, they will appear here
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    {/* Today Section */}
                    {recentNotifications.some(n => {
                      const today = new Date();
                      const notifDate = new Date(n.createdAt);
                      return notifDate.toDateString() === today.toDateString();
                    }) && (
                      <div className="mb-2">
                        <h3 className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Today
                        </h3>
                        <div className="space-y-1">
                          {recentNotifications
                            .filter(n => {
                              const today = new Date();
                              const notifDate = new Date(n.createdAt);
                              return notifDate.toDateString() === today.toDateString();
                            })
                            .map(notification => (
                              <NotificationItem
                                key={notification.id}
                                {...notification}
                                onMarkRead={markAsRead}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Yesterday Section */}
                    {recentNotifications.some(n => {
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);
                      const notifDate = new Date(n.createdAt);
                      return notifDate.toDateString() === yesterday.toDateString();
                    }) && (
                      <div className="mb-2">
                        <h3 className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Yesterday
                        </h3>
                        <div className="space-y-1">
                          {recentNotifications
                            .filter(n => {
                              const today = new Date();
                              const yesterday = new Date(today);
                              yesterday.setDate(yesterday.getDate() - 1);
                              const notifDate = new Date(n.createdAt);
                              return notifDate.toDateString() === yesterday.toDateString();
                            })
                            .map(notification => (
                              <NotificationItem
                                key={notification.id}
                                {...notification}
                                onMarkRead={markAsRead}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Older notifications */}
                    {recentNotifications.some(n => {
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);
                      const notifDate = new Date(n.createdAt);
                      return notifDate < yesterday;
                    }) && (
                      <div>
                        <div className="space-y-1">
                          {recentNotifications
                            .filter(n => {
                              const today = new Date();
                              const yesterday = new Date(today);
                              yesterday.setDate(yesterday.getDate() - 1);
                              const notifDate = new Date(n.createdAt);
                              return notifDate < yesterday;
                            })
                            .slice(0, 2)
                            .map(notification => (
                              <NotificationItem
                                key={notification.id}
                                {...notification}
                                onMarkRead={markAsRead}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer - View All Button */}
              {recentNotifications.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-white/[0.05]">
                  <button
                    onClick={handleViewAll}
                    className="w-full h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    View All Notifications
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
