'use client';
import dynamic from 'next/dynamic';
const AdminConsole = dynamic(() => import('../../../../src/features/system-admin/admin-console'), { ssr: false });
export default function AdminAuditPage() {
  return <AdminConsole activeTabProp="audit" />;
}