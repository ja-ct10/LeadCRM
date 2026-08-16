'use client';
import dynamic from 'next/dynamic';
const AdminConsole = dynamic(() => import('@/features/system-admin/admin-console'), { ssr: false });
export default function AdminPaymentsPage() {
  return <AdminConsole activeTabProp="admin-payments" />;
}
