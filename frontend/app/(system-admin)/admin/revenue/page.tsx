'use client';
import dynamic from 'next/dynamic';
const AdminConsole = dynamic(() => import('../../../../src/features/system-admin/admin-console'), { ssr: false });
export default function AdminRevenuePage() {
  return <AdminConsole activeTabProp="admin-revenue" />;
}
