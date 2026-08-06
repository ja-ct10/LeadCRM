'use client';
import dynamic from 'next/dynamic';
const ReportsPage = dynamic(() => import('../../../src/features/tenant/reporting/ui/reports-page'), { ssr: false });
export default ReportsPage;
