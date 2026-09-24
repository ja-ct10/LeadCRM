'use client';
import React from 'react';
import { SideSheet } from '@/shared/components/side-sheet';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { CampaignBuilder } from './campaign-builder';
interface CreateCampaignPanelProps { isOpen: boolean; onClose: () => void; initialType?: string; initialContent?: string }
export function CreateCampaignPanel({ isOpen, onClose, initialType, initialContent }: CreateCampaignPanelProps) {
  const canSend = useHasPermission('campaigns.send');
  const type = initialType === 'EMAIL' ? 'Email' : initialType === 'MULTI_CHANNEL' ? 'Multi-Channel' : initialType;
  return <SideSheet isOpen={isOpen} onClose={onClose} title="Create Campaign" width="w-full max-w-6xl">
    {isOpen && <CampaignBuilder onBack={onClose} initialType={type} initialContent={initialContent} canSend={canSend} />}
  </SideSheet>;
}
export default CreateCampaignPanel;
