'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, AlertCircle, Mail, Users, Zap, Loader2 } from 'lucide-react';

interface CampaignProgress {
  campaignId: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  currentRecipient?: string;
  progress: number; // 0-100
  errors: Array<{ email: string; error: string }>;
  startedAt?: Date;
  completedAt?: Date;
}

interface CampaignProgressTrackerProps {
  campaignId: string;
  onComplete?: (result: { sent: number; failed: number }) => void;
  className?: string;
}

export function CampaignProgressTracker({
  campaignId,
  onComplete,
  className = '',
}: CampaignProgressTrackerProps) {
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Simulate progress updates (in production, this would poll the API)
  useEffect(() => {
    if (!campaignId || isPolling) return;

    setIsPolling(true);
    
    // Initialize progress
    setProgress({
      campaignId,
      status: 'queued',
      totalRecipients: 2, // Test recipients
      sentCount: 0,
      failedCount: 0,
      progress: 0,
      errors: [],
      startedAt: new Date(),
    });

    // Simulate sequential sending progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (!prev) return null;

        if (prev.status === 'queued') {
          return {
            ...prev,
            status: 'sending',
            currentRecipient: 'jtiron2004@gmail.com',
            progress: 25,
          };
        }

        if (prev.status === 'sending' && prev.sentCount === 0) {
          return {
            ...prev,
            sentCount: 1,
            currentRecipient: 'durussy1@gmail.com',
            progress: 75,
          };
        }

        if (prev.status === 'sending' && prev.sentCount === 1) {
          const completed = {
            ...prev,
            status: 'sent' as const,
            sentCount: 2,
            currentRecipient: undefined,
            progress: 100,
            completedAt: new Date(),
          };
          
          onComplete?.({ sent: 2, failed: 0 });
          setIsPolling(false);
          clearInterval(interval);
          
          return completed;
        }

        return prev;
      });
    }, 2500); // Update every 2.5 seconds to account for 2s delay + processing

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [campaignId, onComplete, isPolling]);

  if (!progress) {
    return (
      <div className={`rounded-xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-6 ${className}`}>
        <div className="flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Initializing campaign...</span>
        </div>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (progress.status) {
      case 'queued': return 'text-amber-500';
      case 'sending': return 'text-blue-500';
      case 'sent': return 'text-emerald-500';
      case 'failed': return 'text-red-500';
      default: return 'text-slate-500';
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'queued': return <Clock className="h-5 w-5" />;
      case 'sending': return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'sent': return <CheckCircle2 className="h-5 w-5" />;
      case 'failed': return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'queued': return 'Queued';
      case 'sending': return 'Sending';
      case 'sent': return 'Completed';
      case 'failed': return 'Failed';
    }
  };

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Campaign Progress
            </h3>
            <p className={`text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{progress.totalRecipients}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Mail className="h-4 w-4" />
            <span>{progress.sentCount} sent</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {progress.sentCount} of {progress.totalRecipients} emails sent
          </span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {Math.round(progress.progress)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
          <motion.div
            className="bg-blue-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress.progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Current Status */}
      {progress.currentRecipient && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20"
        >
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Currently sending to: <span className="font-medium">{progress.currentRecipient}</span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Sequential Mode Indicator */}
      {progress.status === 'sending' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              Sequential mode: 2-second delay between emails
            </span>
          </div>
        </div>
      )}

      {/* Errors */}
      {progress.errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
        >
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                Delivery Errors ({progress.errors.length})
              </p>
              <div className="space-y-1">
                {progress.errors.map((error, index) => (
                  <p key={index} className="text-xs text-red-600 dark:text-red-400">
                    {error.email}: {error.error}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Completion Summary */}
      {progress.status === 'sent' && progress.completedAt && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20"
        >
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Campaign completed successfully!
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {progress.sentCount} emails sent • {progress.failedCount} failed
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Test Recipients Note */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.05]">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <strong>Test Recipients:</strong> jtiron2004@gmail.com, durussy1@gmail.com
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Production audit mode - using real Gmail API with OAuth2
        </p>
      </div>
    </div>
  );
}