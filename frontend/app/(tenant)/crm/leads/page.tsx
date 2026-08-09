'use client';
import dynamic from 'next/dynamic';
const LeadsPage = dynamic(() => import('../../../../src/features/tenant/crm/leads/ui/leads-page'), { ssr: false });
export default LeadsPage;
