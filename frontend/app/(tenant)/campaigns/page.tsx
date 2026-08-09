'use client';
import dynamic from 'next/dynamic';
const CampaignsPage = dynamic(() => import('../../../src/features/tenant/marketing/campaigns/ui/campaigns-page'), { ssr: false });
export default CampaignsPage;
