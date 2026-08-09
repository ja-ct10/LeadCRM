'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CampaignBuilder } from '@/src/features/tenant/marketing/campaigns/ui/campaign-builder';

export default function CreateCampaignPage() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/campaigns');
    router.refresh();
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900">
      <CampaignBuilder 
        onBack={handleBack}
      />
    </div>
  );
}
