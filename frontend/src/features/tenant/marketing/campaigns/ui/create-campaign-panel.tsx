'use client';

import React, { useState } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import { SideSheet } from '@/shared/components/side-sheet';
import { Send, Mail, MessageSquare, Calendar, X, Loader2 } from 'lucide-react';
import { CampaignTypeSelector } from './campaign-type-selector';
import { SmsPreview } from './sms-preview';
import { EmailPreview } from './email-preview';
import { AccessibleSwitch } from './accessible-switch';

interface CreateCampaignPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
  initialContent?: string;
}

export function CreateCampaignPanel({ isOpen, onClose, initialType, initialContent }: CreateCampaignPanelProps) {
  const { addCampaign } = useData();
  const { tenant } = useAuth();

  const [campaignType, setCampaignType] = useState(initialType ?? 'EMAIL');
  const [subject, setSubject]           = useState('');
  const [body, setBody]                 = useState(initialContent ?? '');
  const [scheduledFor, setScheduledFor] = useState('');
  const [isScheduled, setIsScheduled]   = useState(false);
  const [isSending, setIsSending]       = useState(false);

  const handleSubmit = async () => {
    if (!tenant) return;
    if (!subject.trim() && campaignType !== 'SMS') {
      toast.error('Subject is required for email campaigns');
      return;
    }
    if (!body.trim()) {
      toast.error('Message body is required');
      return;
    }
    setIsSending(true);
    try {
      await addCampaign({
        name: subject || 'Untitled Campaign',
        type: campaignType as 'EMAIL' | 'SMS' | 'MULTI_CHANNEL',
        status: isScheduled ? 'SCHEDULED' : 'DRAFT',
        subject,
        body,
        scheduledFor: isScheduled && scheduledFor ? scheduledFor : undefined,
        targetAudienceId: undefined,
        emailTemplateId: undefined,
        smsTemplateId: undefined,
        sentCount: 0,
        openedCount: 0,
        clickedCount: 0,
        engagement: 0,
        isArchived: false,
      } as any);
      toast.success('Campaign created successfully');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SideSheet isOpen={isOpen} onClose={onClose} title="Create Campaign">
      <div className="p-6 space-y-5">
        {/* Campaign Type */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
            Campaign Type
          </label>
          <CampaignTypeSelector value={campaignType} onChange={setCampaignType} />
        </div>

        {/* Subject (email only) */}
        {campaignType !== 'SMS' && (
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Mail size={12} /> Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line..."
              className="h-9 w-full rounded-md border border-gray-200 dark:border-white/8 bg-white dark:bg-white/2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        {/* Body */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <MessageSquare size={12} /> Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Write your message..."
            className="w-full rounded-md border border-gray-200 dark:border-white/8 bg-white dark:bg-white/2 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
        </div>

        {/* Preview */}
        {campaignType === 'SMS'
          ? <SmsPreview content={body} />
          : <EmailPreview subject={subject} content={body} />
        }

        {/* Schedule toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar size={14} /> Schedule for later
          </label>
          <AccessibleSwitch checked={isScheduled} onChange={setIsScheduled} label="Schedule" />
        </div>

        {isScheduled && (
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 dark:border-white/8 bg-white dark:bg-white/2 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/8 bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <X size={14} className="inline mr-1" /> Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSending}
            aria-label="Create Campaign"
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending
              ? <><Loader2 size={14} className="inline mr-1 animate-spin" /> Sending...</>
              : <><Send size={14} className="inline mr-1" /> {isScheduled ? 'Schedule' : 'Create'}</>
            }
          </button>
        </div>
      </div>
    </SideSheet>
  );
}

export default CreateCampaignPanel;
