'use client';
import dynamic from 'next/dynamic';
const AuditLogsPage = dynamic(() => import('../../../../src/features/tenant/administration/audit/ui/audit-logs-page'), { ssr: false });
export default AuditLogsPage;
